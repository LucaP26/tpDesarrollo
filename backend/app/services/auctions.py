from __future__ import annotations

from datetime import datetime, timedelta
from math import ceil

from app.core.time import utc_now
from app.domain.constants import COMPANY_CLIENT_ID
from fastapi import HTTPException, status

from app.domain.enums import (
    AuctionState,
    BidStatus,
    CATEGORY_ORDER,
    Currency,
    NotificationKind,
    PaymentStatus,
    UserCategory,
)
from app.domain.schemas import (
    ActiveAuctionResponse,
    AppUser,
    AuctionDetailResponse,
    AuctionLotRecord,
    AuctionLotView,
    AuctionRecord,
    AuctionSummaryResponse,
    BidCreate,
    BidPublicView,
    BidRecord,
    BidResponse,
    JoinAuctionResponse,
    LeaveAuctionResponse,
    MessageResponse,
    PurchaseRecord,
    WatchlistRecord,
)
from app.services.notifications import NotificationService
from app.services.realtime import RealtimeManager
from app.services.messages import MessageService
from app.services.shipping_compliance import (
    COORDINATION_DEADLINE_HOURS,
    SHIPPING_PENALTY_RATE,
    apply_overdue_shipping_coordination_penalties,
)
from app.services.store import StoreBase
from app.services.user_categories import promote_user_category


class AuctionService:
    BID_WINDOW_SECONDS = 60

    def __init__(
        self,
        store: StoreBase,
        notifications: NotificationService,
        realtime: RealtimeManager,
        messages: MessageService,
    ) -> None:
        self.store = store
        self.notifications = notifications
        self.realtime = realtime
        self.messages = messages

    def _scheduled_at(self, auction: AuctionRecord) -> datetime:
        return datetime.combine(auction.scheduled_date, auction.scheduled_time)

    def _activate_if_due(self, auction: AuctionRecord) -> bool:
        if auction.state == AuctionState.PROGRAMADA and self._scheduled_at(auction) <= utc_now():
            auction.state = AuctionState.ABIERTA
            return True
        return False

    def _price_available(self, user: AppUser | None) -> bool:
        return user is not None and user.approved

    def _sync_category(self, user: AppUser) -> None:
        if promote_user_category(self.store, self.notifications, user):
            self.store.persist_all()

    def _category_label(self, category: UserCategory) -> str:
        labels = {
            UserCategory.COMUN: "Comun",
            UserCategory.ESPECIAL: "Especial",
            UserCategory.PLATA: "Plata",
            UserCategory.ORO: "Oro",
            UserCategory.PLATINO: "Platino",
        }
        return labels[category]

    def _catalog_block_reason(self, user: AppUser | None) -> str | None:
        if user is None:
            return None
        if not user.approved:
            return "Tu cuenta todavia no fue aprobada por la empresa. Una vez aprobada, vas a poder ver el catalogo."
        return None

    def _auction_access_block_reason(self, user: AppUser, auction: AuctionRecord) -> str | None:
        catalog_block = self._catalog_block_reason(user)
        if catalog_block:
            return catalog_block
        if CATEGORY_ORDER[user.category] < CATEGORY_ORDER[auction.category]:
            return (
                f"Tu categoria actual es {self._category_label(user.category)} y esta subasta requiere "
                f"categoria {self._category_label(auction.category)}. Necesitas una categoria igual o superior para conectarte a la sala."
            )
        if auction.state == AuctionState.PROGRAMADA:
            return "Esta subasta esta programada. Podes ver el catalogo, pero no participar hasta que la sala este disponible."
        active_block = self._active_connection_block(user, auction)
        if active_block:
            return active_block
        if not self._registered_payment_methods(user):
            return "Necesitas registrar al menos un medio de pago para conectarte a la subasta."
        return None

    def _active_connection_block(self, user: AppUser, auction: AuctionRecord) -> str | None:
        active_auction = self.store.active_connections_by_user.get(user.id)
        if active_auction and active_auction != auction.id:
            return "No podes estar conectado a mas de una subasta al mismo tiempo."
        return None

    def _searchable_terms(
        self,
        auction: AuctionRecord,
        lots: list[AuctionLotRecord],
        include_lots: bool,
    ) -> list[str]:
        terms = {
            auction.title,
            auction.category.value,
            self._category_label(auction.category),
            auction.auctioneer_name,
            auction.location,
        }
        if include_lots:
            for lot in lots:
                terms.update(
                    value
                    for value in [
                        lot.piece_number,
                        lot.title,
                        lot.description,
                        lot.story,
                        lot.artist,
                    ]
                    if value
                )
            combined = " ".join(terms).lower()
            watch_markers = ["reloj", "timepiece", "omega", "cartier", "rolex", "patek", "audemars"]
            if any(marker in combined for marker in watch_markers):
                terms.update(["watch", "watches", "reloj", "relojes", "timepiece", "timepieces"])
        return sorted(terms)

    def _ordered_lots(self, auction: AuctionRecord) -> list[AuctionLotRecord]:
        return [self.store.lots[lot_id] for lot_id in auction.lot_ids if lot_id in self.store.lots]

    def _current_lot_record(self, auction: AuctionRecord) -> AuctionLotRecord | None:
        for lot in self._ordered_lots(auction):
            if not lot.sold:
                return lot
        return None

    def _seconds_remaining(self, lot: AuctionLotRecord) -> int | None:
        if lot.bid_deadline_at is None or lot.sold:
            return None
        return max(0, ceil((lot.bid_deadline_at - utc_now()).total_seconds()))

    def _start_lot_window(self, lot: AuctionLotRecord, now: datetime) -> None:
        lot.bidding_started_at = now
        lot.bid_deadline_at = now + timedelta(seconds=self.BID_WINDOW_SECONDS)

    def _sync_auction_clock(self, auction: AuctionRecord) -> bool:
        if self._activate_if_due(auction):
            return True
        if auction.state != AuctionState.ABIERTA:
            return False

        changed = False
        now = utc_now()
        current_lot = self._current_lot_record(auction)
        if current_lot is None:
            auction.state = AuctionState.CERRADA
            return True

        if current_lot.bid_deadline_at is None:
            self._start_lot_window(current_lot, now)
            return True

        if current_lot.bid_deadline_at > now:
            return changed

        self._close_single_lot(auction, current_lot)
        changed = True

        next_lot = self._current_lot_record(auction)
        if next_lot is None:
            auction.state = AuctionState.CERRADA
            return changed

        self._start_lot_window(next_lot, utc_now())
        return changed

    def _preview_lot_record(self, auction: AuctionRecord) -> AuctionLotRecord | None:
        lots = self._ordered_lots(auction)
        if not lots:
            return None
        remaining = [lot for lot in lots if not lot.sold]
        return remaining[-1] if remaining else lots[-1]

    def _matching_verified_payments(self, user: AppUser, currency: Currency) -> list:
        return [
            payment
            for payment in self.store.payment_methods.values()
            if payment.user_id == user.id
            and payment.status == PaymentStatus.VERIFICADO
            and payment.currency == currency
        ]

    def _registered_payment_methods(self, user: AppUser) -> list:
        return [
            payment
            for payment in self.store.payment_methods.values()
            if payment.user_id == user.id and payment.status != PaymentStatus.RECHAZADO
        ]

    def _bid_block_reason(self, user: AppUser, auction: AuctionRecord) -> str | None:
        access_block = self._auction_access_block_reason(user, auction)
        if access_block:
            return access_block
        apply_overdue_shipping_coordination_penalties(self.store, self.notifications, user)
        matching = self._matching_verified_payments(user, auction.currency)
        if not matching:
            return "Necesitas al menos un medio de pago verificado en la moneda de la subasta."
        active_penalties = [
            penalty for penalty in self.store.penalties.values() if penalty.user_id == user.id and penalty.status.value == "activa"
        ]
        if active_penalties:
            return "Tenes una multa pendiente y no podes pujar hasta regularizarla."
        return None

    def _compute_bid_range(self, auction: AuctionRecord, lot: AuctionLotRecord) -> tuple[float, float | None]:
        anchor = lot.current_bid if lot.current_bid is not None else lot.base_price
        if auction.category in {UserCategory.ORO, UserCategory.PLATINO}:
            min_bid = lot.base_price if lot.current_bid is None else round(anchor + 0.01, 2)
            return min_bid, None
        min_bid = lot.base_price if lot.current_bid is None else round(anchor + (lot.base_price * 0.01), 2)
        max_bid = round(anchor + (lot.base_price * 0.20), 2)
        return min_bid, max_bid

    def _recalculate_lot_bids(self, lot: AuctionLotRecord) -> None:
        remaining_bids = [self.store.bids[bid_id] for bid_id in lot.bid_ids if bid_id in self.store.bids]
        if not remaining_bids:
            lot.current_bid = None
            lot.current_bidder_id = None
            return

        best_bid = max(remaining_bids, key=lambda bid: (bid.amount, bid.created_at))
        lot.current_bid = best_bid.amount
        lot.current_bidder_id = best_bid.user_id
        for bid in remaining_bids:
            bid.status = BidStatus.CONFIRMADA if bid.id == best_bid.id else BidStatus.SUPERADA

    def _public_bid_history(self, user: AppUser | None, lot: AuctionLotRecord) -> list[BidPublicView]:
        bids = [
            self.store.bids[bid_id]
            for bid_id in lot.bid_ids
            if bid_id in self.store.bids
        ]
        return [
            BidPublicView(
                amount=bid.amount,
                status=bid.status,
                created_at=bid.created_at,
                is_mine=user is not None and bid.user_id == user.id,
            )
            for bid in sorted(bids, key=lambda item: item.created_at)
        ]

    def _realtime_bid_history(self, lot: AuctionLotRecord) -> list[dict]:
        bids = [
            self.store.bids[bid_id]
            for bid_id in lot.bid_ids
            if bid_id in self.store.bids
        ]
        return [
            {
                "amount": bid.amount,
                "status": bid.status.value,
                "created_at": bid.created_at.isoformat(),
                "is_mine": False,
            }
            for bid in sorted(bids, key=lambda item: item.created_at)
        ]

    def _current_commitment(self, user_id: int, currency: Currency) -> float:
        commitment = 0.0
        for auction in self.store.auctions.values():
            if auction.currency != currency or auction.state != AuctionState.ABIERTA:
                continue
            for lot_id in auction.lot_ids:
                lot = self.store.lots[lot_id]
                if lot.current_bidder_id == user_id and lot.current_bid:
                    commitment += lot.current_bid
        for purchase in self.store.purchases.values():
            if purchase.buyer_user_id == user_id and purchase.currency == currency and not purchase.paid:
                commitment += purchase.total_amount
        return commitment

    def _payment_method_commitment(self, user_id: int, currency: Currency, payment_method_id: int, exclude_lot_id: int | None = None) -> float:
        commitment = 0.0
        for auction in self.store.auctions.values():
            if auction.currency != currency or auction.state != AuctionState.ABIERTA:
                continue
            for lot_id in auction.lot_ids:
                if lot_id == exclude_lot_id:
                    continue
                lot = self.store.lots[lot_id]
                if lot.current_bidder_id != user_id or not lot.current_bid:
                    continue
                winning_bid = next(
                    (
                        self.store.bids[bid_id]
                        for bid_id in lot.bid_ids
                        if bid_id in self.store.bids
                        and self.store.bids[bid_id].user_id == user_id
                        and self.store.bids[bid_id].amount == lot.current_bid
                    ),
                    None,
                )
                if winning_bid and winning_bid.payment_method_id == payment_method_id:
                    commitment += lot.current_bid
        for purchase in self.store.purchases.values():
            if (
                purchase.buyer_user_id == user_id
                and purchase.currency == currency
                and not purchase.paid
                and purchase.payment_method_id == payment_method_id
            ):
                commitment += purchase.total_amount
        return commitment

    def _pick_payment(self, user: AppUser, auction: AuctionRecord, payment_method_id: int | None):
        verified = self._matching_verified_payments(user, auction.currency)
        if not verified:
            return None
        if payment_method_id is None:
            return verified[0]
        payment = self.store.payment_methods.get(payment_method_id)
        if not payment or payment.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medio de pago no encontrado.")
        if payment.status != PaymentStatus.VERIFICADO:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El medio de pago aun no fue verificado.")
        if payment.currency != auction.currency:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La moneda del medio de pago no coincide con la subasta.")
        return payment

    def _owner_name(self, owner_user_id: int) -> str | None:
        owner = self.store.users.get(owner_user_id)
        if not owner:
            return None
        return f"{owner.first_name} {owner.last_name}".strip() or owner.email

    def _lot_view(self, user: AppUser | None, auction: AuctionRecord, lot: AuctionLotRecord) -> AuctionLotView:
        block_reason = self._bid_block_reason(user, auction) if user else "Inicia sesion para participar de esta subasta."
        current_lot = self._current_lot_record(auction)
        if auction.state == AuctionState.ABIERTA and current_lot and current_lot.id != lot.id and not lot.sold:
            block_reason = "Solo podes pujar por el lote que esta actualmente en exhibicion."
        price_available = self._price_available(user)
        min_bid, max_bid = self._compute_bid_range(auction, lot) if price_available else (0.0, None)
        return AuctionLotView(
            id=lot.id,
            piece_number=lot.piece_number,
            title=lot.title,
            description=lot.description,
            story=lot.story,
            artist=lot.artist,
            owner_user_id=lot.owner_user_id,
            owner_name=self._owner_name(lot.owner_user_id),
            image_urls=lot.image_urls,
            base_price=lot.base_price if price_available else 0.0,
            price_available=price_available,
            commission_rate=lot.commission_rate,
            current_bid=lot.current_bid if price_available else None,
            current_bidder_id=lot.current_bidder_id if price_available else None,
            bid_history=self._public_bid_history(user, lot) if price_available else [],
            bidding_started_at=lot.bidding_started_at,
            bid_deadline_at=lot.bid_deadline_at,
            bid_seconds_remaining=self._seconds_remaining(lot),
            min_bid=min_bid,
            max_bid=max_bid,
            can_bid=block_reason is None,
            block_reason=block_reason,
            sold=lot.sold,
            sold_to_company=lot.sold_to_company,
        )

    def _auction_summary(self, user: AppUser | None, auction: AuctionRecord) -> AuctionSummaryResponse:
        lots = self._ordered_lots(auction)
        current_lot = self._current_lot_record(auction)
        preview_lot = self._preview_lot_record(auction)
        remaining_lots = len([lot for lot in lots if not lot.sold])
        view_block_reason = self._catalog_block_reason(user)
        block_reason = self._bid_block_reason(user, auction) if user else "Inicia sesion para conectarte y pujar."
        price_available = self._price_available(user)
        can_view_catalog = view_block_reason is None
        return AuctionSummaryResponse(
            id=auction.id,
            title=auction.title,
            scheduled_at=self._scheduled_at(auction),
            category=auction.category,
            currency=auction.currency,
            state=auction.state,
            auctioneer_name=auction.auctioneer_name,
            location=auction.location,
            can_view_catalog=can_view_catalog,
            view_block_reason=view_block_reason,
            connected=self.store.active_connections_by_user.get(user.id) == auction.id if user else False,
            can_bid=block_reason is None,
            block_reason=block_reason,
            current_lot_title=current_lot.title if current_lot else None,
            best_offer=current_lot.current_bid if price_available and current_lot else None,
            preview_lot_title=preview_lot.title if preview_lot else None,
            preview_image_url=preview_lot.image_urls[0] if preview_lot and preview_lot.image_urls else None,
            preview_base_price=preview_lot.base_price if price_available and preview_lot else None,
            price_available=price_available,
            total_lots=len(lots),
            remaining_lots=remaining_lots,
            searchable_terms=self._searchable_terms(auction, lots, can_view_catalog),
            in_watchlist=(user.id, auction.id) in self.store.watchlist if user else False,
        )

    def list_auctions(self, user: AppUser) -> list[AuctionSummaryResponse]:
        self._sync_category(user)
        summaries: list[AuctionSummaryResponse] = []
        for auction in sorted(self.store.auctions.values(), key=self._scheduled_at):
            changed = self._activate_if_due(auction)
            summaries.append(self._auction_summary(user, auction))
            if changed:
                self.store.persist_all()
        return summaries

    def list_public_auctions(self) -> list[AuctionSummaryResponse]:
        summaries: list[AuctionSummaryResponse] = []
        for auction in sorted(self.store.auctions.values(), key=self._scheduled_at):
            changed = self._activate_if_due(auction)
            summaries.append(self._auction_summary(None, auction))
            if changed:
                self.store.persist_all()
        return summaries

    def list_watchlist(self, user: AppUser) -> list[AuctionSummaryResponse]:
        summaries_by_id = {summary.id: summary for summary in self.list_auctions(user)}
        rows = [
            row
            for row in self.store.watchlist.values()
            if row.user_id == user.id and row.auction_id in summaries_by_id
        ]
        rows.sort(key=lambda item: item.created_at, reverse=True)
        return [summaries_by_id[row.auction_id] for row in rows]

    def add_to_watchlist(self, user: AppUser, auction_id: int) -> MessageResponse:
        self._sync_category(user)
        auction = self.store.auctions.get(auction_id)
        if not auction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subasta no encontrada.")
        if self._activate_if_due(auction):
            self.store.persist_all()
        if auction.state != AuctionState.PROGRAMADA:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo podes guardar subastas programadas en Watchlist.")
        view_block_reason = self._catalog_block_reason(user)
        if view_block_reason:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=view_block_reason)

        key = (user.id, auction.id)
        if key not in self.store.watchlist:
            self.store.watchlist[key] = WatchlistRecord(
                user_id=user.id,
                auction_id=auction.id,
                created_at=utc_now(),
            )
            self.store.persist_all()
        return MessageResponse(message="Subasta agregada a Watchlist.")

    def remove_from_watchlist(self, user: AppUser, auction_id: int) -> MessageResponse:
        key = (user.id, auction_id)
        self.store.watchlist.pop(key, None)
        self.store.persist_all()
        return MessageResponse(message="Subasta eliminada de Watchlist.")

    def _auction_detail(self, user: AppUser | None, auction_id: int) -> AuctionDetailResponse:
        auction = self.store.auctions.get(auction_id)
        if not auction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subasta no encontrada.")
        if self._sync_auction_clock(auction):
            self.store.persist_all()
        view_block_reason = self._catalog_block_reason(user)
        if view_block_reason:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=view_block_reason)
        block_reason = self._bid_block_reason(user, auction) if user else "Inicia sesion para conectarte y pujar."
        lots = [self._lot_view(user, auction, lot) for lot in self._ordered_lots(auction)]
        price_available = self._price_available(user)
        current_lot = next((lot for lot in lots if not lot.sold), None) if auction.state == AuctionState.ABIERTA else None
        upcoming_lots = [lot for lot in lots if not lot.sold] if current_lot is None else [lot for lot in lots if lot.id != current_lot.id and not lot.sold]
        completed_lots = [lot for lot in lots if lot.sold]
        preview_lot = self._preview_lot_record(auction)
        return AuctionDetailResponse(
            id=auction.id,
            title=auction.title,
            scheduled_at=self._scheduled_at(auction),
            category=auction.category,
            currency=auction.currency,
            state=auction.state,
            auctioneer_name=auction.auctioneer_name,
            location=auction.location,
            can_view_catalog=True,
            view_block_reason=None,
            connected=self.store.active_connections_by_user.get(user.id) == auction.id if user else False,
            can_bid=block_reason is None,
            block_reason=block_reason,
            current_lot=current_lot,
            upcoming_lots=upcoming_lots,
            completed_lots=completed_lots,
            lots=lots,
            current_lot_title=current_lot.title if current_lot else None,
            best_offer=current_lot.current_bid if price_available and current_lot else None,
            preview_lot_title=preview_lot.title if preview_lot else None,
            preview_image_url=preview_lot.image_urls[0] if preview_lot and preview_lot.image_urls else None,
            preview_base_price=preview_lot.base_price if price_available and preview_lot else None,
            price_available=price_available,
            total_lots=len(lots),
            remaining_lots=len(upcoming_lots) + (1 if current_lot else 0),
        )

    def get_auction(self, user: AppUser, auction_id: int) -> AuctionDetailResponse:
        self._sync_category(user)
        return self._auction_detail(user, auction_id)

    def get_public_auction(self, auction_id: int) -> AuctionDetailResponse:
        return self._auction_detail(None, auction_id)

    def join_auction(self, user: AppUser, auction_id: int) -> JoinAuctionResponse:
        self._sync_category(user)
        auction = self.store.auctions.get(auction_id)
        if not auction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subasta no encontrada.")
        self._sync_auction_clock(auction)
        block_reason = self._auction_access_block_reason(user, auction)
        if block_reason:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=block_reason)
        self.store.active_connections_by_user[user.id] = auction.id
        self.store.auction_attendance_by_user[user.id].add(auction.id)
        promote_user_category(self.store, self.notifications, user)
        bid_block = self._bid_block_reason(user, auction)
        self.store.persist_all()
        return JoinAuctionResponse(
            auction_id=auction.id,
            connected=True,
            can_bid=bid_block is None,
            block_reason=bid_block,
            websocket_path=f"/ws/subastas/{auction.id}",
            user_category=user.category,
        )

    def get_active_auction(self, user: AppUser) -> ActiveAuctionResponse | None:
        self._sync_category(user)
        auction_id = self.store.active_connections_by_user.get(user.id)
        if not auction_id:
            return None

        auction = self.store.auctions.get(auction_id)
        if not auction or auction.state != AuctionState.ABIERTA:
            self.store.active_connections_by_user.pop(user.id, None)
            return None
        if self._sync_auction_clock(auction):
            self.store.persist_all()
        if auction.state != AuctionState.ABIERTA:
            self.store.active_connections_by_user.pop(user.id, None)
            self.store.persist_all()
            return None

        current_lot = self._current_lot_record(auction)
        my_latest_bid = None
        if current_lot:
            my_bids = [
                self.store.bids[bid_id]
                for bid_id in current_lot.bid_ids
                if bid_id in self.store.bids and self.store.bids[bid_id].user_id == user.id
            ]
            if my_bids:
                my_latest_bid = max(my_bids, key=lambda bid: bid.created_at).amount

        return ActiveAuctionResponse(
            auction_id=auction.id,
            title=auction.title,
            category=auction.category,
            currency=auction.currency,
            scheduled_at=self._scheduled_at(auction),
            location=auction.location,
            current_lot_id=current_lot.id if current_lot else None,
            current_lot_title=current_lot.title if current_lot else None,
            current_lot_image_url=current_lot.image_urls[0] if current_lot and current_lot.image_urls else None,
            current_price=current_lot.current_bid if current_lot and current_lot.current_bid is not None else (current_lot.base_price if current_lot else None),
            my_latest_bid=my_latest_bid,
            my_is_leading=current_lot.current_bidder_id == user.id if current_lot else False,
        )

    async def leave_auction(self, user: AppUser, auction_id: int) -> LeaveAuctionResponse:
        auction = self.store.auctions.get(auction_id)
        if not auction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subasta no encontrada.")
        if self.store.active_connections_by_user.get(user.id) != auction_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No estas participando activamente en esa subasta.")

        removed_bid_amount = None
        new_current_bid = None
        new_current_bidder_id = None
        current_lot = self._current_lot_record(auction)

        async with self.store.lock_for_auction(auction_id):
            pending_lots = [lot for lot in self._ordered_lots(auction) if not lot.sold]
            for lot in pending_lots:
                user_bid_ids = [bid_id for bid_id in lot.bid_ids if bid_id in self.store.bids and self.store.bids[bid_id].user_id == user.id]
                if not user_bid_ids:
                    continue

                removed_bids = [self.store.bids[bid_id] for bid_id in user_bid_ids]
                latest_removed_bid = max(removed_bids, key=lambda bid: bid.created_at)
                removed_bid_amount = latest_removed_bid.amount

                lot.bid_ids = [bid_id for bid_id in lot.bid_ids if bid_id not in user_bid_ids]
                for bid_id in user_bid_ids:
                    self.store.bids.pop(bid_id, None)

                self._recalculate_lot_bids(lot)
                if current_lot and lot.id == current_lot.id:
                    new_current_bid = lot.current_bid
                    new_current_bidder_id = lot.current_bidder_id

            self.store.active_connections_by_user.pop(user.id, None)
            self.notifications.create(
                user.id,
                "Abandonaste la subasta",
                "Ya puedes ingresar a otra sala. Tus pujas activas en la sala actual fueron retiradas.",
                NotificationKind.INFO,
            )

            if current_lot:
                min_bid, max_bid = self._compute_bid_range(auction, current_lot)
                await self.realtime.broadcast(
                    auction.id,
                    {
                        "type": "bid.updated",
                        "auction_id": auction.id,
                        "lot_id": current_lot.id,
                        "amount": current_lot.current_bid,
                        "user_id": current_lot.current_bidder_id,
                        "min_bid": min_bid,
                        "max_bid": max_bid,
                        "bid_history": self._realtime_bid_history(current_lot),
                        "timestamp": utc_now().isoformat(),
                    },
                )

            self.store.persist_all()

        return LeaveAuctionResponse(
            message="Abandonaste la subasta actual y ya puedes participar en otra.",
            auction_id=auction.id,
            removed_bid_amount=removed_bid_amount,
            new_current_bid=new_current_bid,
            new_current_bidder_id=new_current_bidder_id,
        )

    async def place_bid(self, user: AppUser, auction_id: int, lot_id: int, payload: BidCreate) -> BidResponse:
        auction = self.store.auctions.get(auction_id)
        lot = self.store.lots.get(lot_id)
        if not auction or not lot or lot.auction_id != auction_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote no encontrado.")
        if self._sync_auction_clock(auction):
            self.store.persist_all()
        if auction.state == AuctionState.PROGRAMADA:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta subasta esta programada. Las pujas se habilitaran cuando la sala este disponible.",
            )
        if auction.state != AuctionState.ABIERTA or lot.sold:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La subasta ya no recibe pujas.")
        current_lot = self._current_lot_record(auction)
        if not current_lot or current_lot.id != lot.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo podes pujar por el lote que esta actualmente en exhibicion.",
            )
        if self.store.active_connections_by_user.get(user.id) != auction_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Primero debes conectarte a la subasta.")

        bid_block = self._bid_block_reason(user, auction)
        if bid_block:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=bid_block)

        async with self.store.lock_for_auction(auction_id):
            if self._sync_auction_clock(auction):
                self.store.persist_all()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El tiempo del lote vencio. La sala avanzo al siguiente lote.",
                )
            payment = self._pick_payment(user, auction, payload.payment_method_id)
            min_bid, max_bid = self._compute_bid_range(auction, lot)
            if payload.amount < min_bid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"La puja minima es {min_bid}.")
            if max_bid is not None and payload.amount > max_bid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"La puja maxima es {max_bid}.")
            if lot.current_bid is not None and payload.amount <= lot.current_bid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La oferta debe ser mayor a la mejor actual.")

            if payment:
                commitment = self._payment_method_commitment(user.id, auction.currency, payment.id, exclude_lot_id=lot.id)
                if round(commitment + payload.amount, 2) > round(payment.available_amount, 2):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Tu método de pago no tiene fondos suficientes.",
                    )

            previous_best_user = lot.current_bidder_id
            for bid_id in lot.bid_ids:
                bid = self.store.bids[bid_id]
                if bid.status == BidStatus.CONFIRMADA:
                    bid.status = BidStatus.SUPERADA

            bid = BidRecord(
                id=self.store.next_id("bids"),
                auction_id=auction.id,
                lot_id=lot.id,
                user_id=user.id,
                amount=round(payload.amount, 2),
                status=BidStatus.CONFIRMADA,
                created_at=utc_now(),
                payment_method_id=payment.id if payment else None,
            )
            self.store.bids[bid.id] = bid
            lot.bid_ids.append(bid.id)
            lot.current_bid = bid.amount
            lot.current_bidder_id = user.id
            if lot.bidding_started_at is None:
                lot.bidding_started_at = bid.created_at
            lot.bid_deadline_at = bid.created_at + timedelta(seconds=self.BID_WINDOW_SECONDS)

            if previous_best_user and previous_best_user != user.id:
                self.notifications.create(
                    previous_best_user,
                    "Te superaron una oferta",
                    f"El lote {lot.piece_number} ahora tiene una mejor oferta de {bid.amount} {auction.currency.value}.",
                    NotificationKind.ALERTA,
                )

            self.notifications.create(
                user.id,
                "Puja confirmada",
                f"Tu oferta por {bid.amount} {auction.currency.value} fue registrada con exito.",
                NotificationKind.OPERACION,
            )

            next_min_bid, next_max_bid = self._compute_bid_range(auction, lot)
            await self.realtime.broadcast(
                auction.id,
                {
                    "type": "bid.updated",
                    "auction_id": auction.id,
                    "lot_id": lot.id,
                    "amount": bid.amount,
                    "user_id": user.id,
                    "min_bid": next_min_bid,
                    "max_bid": next_max_bid,
                    "bid_history": self._realtime_bid_history(lot),
                    "bid_deadline_at": lot.bid_deadline_at.isoformat(),
                    "bid_seconds_remaining": self._seconds_remaining(lot),
                    "timestamp": bid.created_at.isoformat(),
                },
            )
            self.store.persist_all()

            return BidResponse(
                bid_id=bid.id,
                auction_id=auction.id,
                lot_id=lot.id,
                amount=bid.amount,
                status=bid.status,
                current_best_bid=lot.current_bid or bid.amount,
                current_best_bidder_id=lot.current_bidder_id or user.id,
                min_bid=next_min_bid,
                max_bid=next_max_bid,
            )

    def _close_single_lot(self, auction: AuctionRecord, lot: AuctionLotRecord) -> dict:
        if lot.current_bidder_id is not None and lot.current_bid is not None:
            winning_bids = [
                self.store.bids[bid_id]
                for bid_id in lot.bid_ids
                if bid_id in self.store.bids
                and self.store.bids[bid_id].user_id == lot.current_bidder_id
                and self.store.bids[bid_id].amount == lot.current_bid
            ]
            winning_bid = max(winning_bids, key=lambda bid: bid.created_at) if winning_bids else None
            purchase = PurchaseRecord(
                id=self.store.next_id("purchases"),
                auction_id=auction.id,
                lot_id=lot.id,
                buyer_user_id=lot.current_bidder_id,
                owner_user_id=lot.owner_user_id,
                hammer_price=lot.current_bid,
                commission_amount=round(lot.current_bid * lot.commission_rate, 2),
                shipping_amount=round(lot.base_price * 0.05, 2),
                total_amount=round(lot.current_bid + (lot.current_bid * lot.commission_rate) + (lot.base_price * 0.05), 2),
                currency=auction.currency,
                payment_method_id=winning_bid.payment_method_id if winning_bid else None,
                created_at=utc_now(),
            )
            self.store.purchases[purchase.id] = purchase
            lot.sold = True
            lot.bid_deadline_at = None
            winner = self.store.users[lot.current_bidder_id]
            winner.won_purchase_ids.append(purchase.id)
            if winning_bid:
                winning_bid.status = BidStatus.GANADORA
            self.notifications.create(
                winner.id,
                "Ganaste la subasta",
                (
                    f"El lote {lot.piece_number} es tuyo. Total a pagar: {purchase.total_amount} {auction.currency.value}. "
                    f"Inicia la coordinacion de entrega dentro de {COORDINATION_DEADLINE_HOURS} horas o se aplicara "
                    f"una multa del {int(SHIPPING_PENALTY_RATE * 100)}%."
                ),
                NotificationKind.OPERACION,
            )
            self.messages.open_purchase_notice(
                winner.id,
                f"Compra ganada: {lot.piece_number}",
                (
                    f"Ganaste el lote {lot.piece_number} - {lot.title}. "
                    f"Importe ofertado: {purchase.hammer_price} {auction.currency.value}. "
                    f"Comisiones: {purchase.commission_amount} {auction.currency.value}. "
                    f"Costo de envio a tu direccion declarada: {purchase.shipping_amount} {auction.currency.value}. "
                    f"Total a pagar: {purchase.total_amount} {auction.currency.value}. "
                    f"Debes iniciar la coordinacion de entrega desde Articulos ganados dentro de las "
                    f"{COORDINATION_DEADLINE_HOURS} horas posteriores a la adjudicacion. Si no lo haces, "
                    f"se aplicara una multa del {int(SHIPPING_PENALTY_RATE * 100)}% del total adjudicado. "
                    "Tambien podes retirar personalmente el bien; en ese caso, una vez retirado pierde la cobertura del seguro."
                ),
            )
            self.notifications.create(
                lot.owner_user_id,
                "Lote vendido",
                f"Tu lote {lot.piece_number} fue vendido por {lot.current_bid} {auction.currency.value}.",
                NotificationKind.INFO,
            )
            return {"sold_to_company": False, "purchase_id": purchase.id}

        lot.sold = True
        lot.bid_deadline_at = None
        lot.sold_to_company = True
        purchase = PurchaseRecord(
            id=self.store.next_id("purchases"),
            auction_id=auction.id,
            lot_id=lot.id,
            buyer_user_id=COMPANY_CLIENT_ID,
            owner_user_id=lot.owner_user_id,
            hammer_price=lot.base_price,
            commission_amount=0.0,
            shipping_amount=0.0,
            total_amount=lot.base_price,
            currency=auction.currency,
            payment_method_id=None,
            created_at=utc_now(),
        )
        self.store.purchases[purchase.id] = purchase
        self.notifications.create(
            lot.owner_user_id,
            "Lote comprado por la empresa",
            f"Tu lote {lot.piece_number} no recibio pujas y la empresa lo compro por el valor base de {lot.base_price} {auction.currency.value}.",
            NotificationKind.INFO,
        )
        return {"sold_to_company": True, "purchase_id": purchase.id}

    def close_current_lot(self, auction_id: int) -> dict:
        auction = self.store.auctions.get(auction_id)
        if not auction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subasta no encontrada.")

        current_lot = self._current_lot_record(auction)
        if not current_lot:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No hay lotes pendientes en esta subasta.")

        result = self._close_single_lot(auction, current_lot)
        next_lot = self._current_lot_record(auction)
        if next_lot is None:
            auction.state = AuctionState.CERRADA
        else:
            self._start_lot_window(next_lot, utc_now())

        self.store.persist_all()
        return {
            "auction_id": auction.id,
            "closed_lot_id": current_lot.id,
            "closed_lot_title": current_lot.title,
            "winner_user_id": current_lot.current_bidder_id,
            "sold_to_company": result["sold_to_company"],
            "next_lot_id": next_lot.id if next_lot else None,
            "next_lot_title": next_lot.title if next_lot else None,
            "state": auction.state,
        }

    def close_auction(self, auction_id: int) -> dict:
        auction = self.store.auctions.get(auction_id)
        if not auction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subasta no encontrada.")
        auction.state = AuctionState.CERRADA

        closed_lots = 0
        company_purchases = 0
        for lot in self._ordered_lots(auction):
            if lot.sold:
                continue
            closed_lots += 1
            result = self._close_single_lot(auction, lot)
            if result["sold_to_company"]:
                company_purchases += 1

        disconnected_users = [
            user_id for user_id, current_auction in self.store.active_connections_by_user.items() if current_auction == auction.id
        ]
        for user_id in disconnected_users:
            self.store.active_connections_by_user.pop(user_id, None)
        self.store.persist_all()
        return {
            "auction_id": auction.id,
            "state": auction.state,
            "closed_lots": closed_lots,
            "company_purchases": company_purchases,
        }
