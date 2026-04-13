from __future__ import annotations

from datetime import datetime

from app.core.time import utc_now
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
    BidRecord,
    BidResponse,
    JoinAuctionResponse,
    LeaveAuctionResponse,
    PurchaseRecord,
)
from app.services.notifications import NotificationService
from app.services.realtime import RealtimeManager
from app.services.store import StoreBase
from app.services.user_categories import promote_user_category


class AuctionService:
    def __init__(
        self,
        store: StoreBase,
        notifications: NotificationService,
        realtime: RealtimeManager,
    ) -> None:
        self.store = store
        self.notifications = notifications
        self.realtime = realtime

    def _scheduled_at(self, auction: AuctionRecord) -> datetime:
        return datetime.combine(auction.scheduled_date, auction.scheduled_time)

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

    def _can_view(self, user: AppUser, auction: AuctionRecord) -> str | None:
        if not user.approved:
            return "Tu cuenta todavia no fue aprobada por la empresa. Una vez aprobada, vas a poder ver el catalogo."
        if CATEGORY_ORDER[user.category] < CATEGORY_ORDER[auction.category]:
            return (
                f"Tu categoria actual es {self._category_label(user.category)} y esta subasta requiere "
                f"categoria {self._category_label(auction.category)}. Necesitas una categoria igual o superior para ver el catalogo."
            )
        active_auction = self.store.active_connections_by_user.get(user.id)
        if active_auction and active_auction != auction.id:
            return "No podes estar conectado a mas de una subasta al mismo tiempo."
        return None

    def _ordered_lots(self, auction: AuctionRecord) -> list[AuctionLotRecord]:
        return [self.store.lots[lot_id] for lot_id in auction.lot_ids if lot_id in self.store.lots]

    def _current_lot_record(self, auction: AuctionRecord) -> AuctionLotRecord | None:
        for lot in self._ordered_lots(auction):
            if not lot.sold:
                return lot
        return None

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

    def _bid_block_reason(self, user: AppUser, auction: AuctionRecord) -> str | None:
        view_block = self._can_view(user, auction)
        if view_block:
            return view_block
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
        min_bid = lot.base_price if lot.current_bid is None else round(anchor + (lot.base_price * 0.01), 2)
        if auction.category in {UserCategory.ORO, UserCategory.PLATINO}:
            return min_bid, None
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

    def _lot_view(self, user: AppUser, auction: AuctionRecord, lot: AuctionLotRecord) -> AuctionLotView:
        block_reason = self._bid_block_reason(user, auction)
        current_lot = self._current_lot_record(auction)
        if current_lot and current_lot.id != lot.id and not lot.sold:
            block_reason = "Solo podes pujar por el lote que esta actualmente en exhibicion."
        min_bid, max_bid = self._compute_bid_range(auction, lot)
        return AuctionLotView(
            id=lot.id,
            piece_number=lot.piece_number,
            title=lot.title,
            description=lot.description,
            story=lot.story,
            artist=lot.artist,
            image_urls=lot.image_urls,
            base_price=lot.base_price,
            commission_rate=lot.commission_rate,
            current_bid=lot.current_bid,
            current_bidder_id=lot.current_bidder_id,
            min_bid=min_bid,
            max_bid=max_bid,
            can_bid=block_reason is None,
            block_reason=block_reason,
            sold=lot.sold,
            sold_to_company=lot.sold_to_company,
        )

    def list_auctions(self, user: AppUser) -> list[AuctionSummaryResponse]:
        self._sync_category(user)
        summaries: list[AuctionSummaryResponse] = []
        for auction in sorted(self.store.auctions.values(), key=self._scheduled_at):
            lots = self._ordered_lots(auction)
            current_lot = self._current_lot_record(auction)
            preview_lot = self._preview_lot_record(auction)
            remaining_lots = len([lot for lot in lots if not lot.sold])
            view_block_reason = self._can_view(user, auction)
            block_reason = self._bid_block_reason(user, auction)
            summaries.append(
                AuctionSummaryResponse(
                    id=auction.id,
                    title=auction.title,
                    scheduled_at=self._scheduled_at(auction),
                    category=auction.category,
                    currency=auction.currency,
                    state=auction.state,
                    auctioneer_name=auction.auctioneer_name,
                    location=auction.location,
                    can_view_catalog=view_block_reason is None,
                    view_block_reason=view_block_reason,
                    can_bid=block_reason is None,
                    block_reason=block_reason,
                    current_lot_title=current_lot.title if current_lot else None,
                    best_offer=current_lot.current_bid if current_lot else None,
                    preview_lot_title=preview_lot.title if preview_lot else None,
                    preview_image_url=preview_lot.image_urls[0] if preview_lot and preview_lot.image_urls else None,
                    preview_base_price=preview_lot.base_price if preview_lot else None,
                    total_lots=len(lots),
                    remaining_lots=remaining_lots,
                )
            )
        return summaries

    def get_auction(self, user: AppUser, auction_id: int) -> AuctionDetailResponse:
        self._sync_category(user)
        auction = self.store.auctions.get(auction_id)
        if not auction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subasta no encontrada.")
        view_block_reason = self._can_view(user, auction)
        if view_block_reason:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=view_block_reason)
        block_reason = self._bid_block_reason(user, auction)
        lots = [self._lot_view(user, auction, lot) for lot in self._ordered_lots(auction)]
        current_lot = next((lot for lot in lots if not lot.sold), None)
        upcoming_lots = [lot for lot in lots if current_lot and lot.id != current_lot.id and not lot.sold]
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
            can_bid=block_reason is None,
            block_reason=block_reason,
            current_lot=current_lot,
            upcoming_lots=upcoming_lots,
            completed_lots=completed_lots,
            lots=lots,
            current_lot_title=current_lot.title if current_lot else None,
            best_offer=current_lot.current_bid if current_lot else None,
            preview_lot_title=preview_lot.title if preview_lot else None,
            preview_image_url=preview_lot.image_urls[0] if preview_lot and preview_lot.image_urls else None,
            preview_base_price=preview_lot.base_price if preview_lot else None,
            total_lots=len(lots),
            remaining_lots=len(upcoming_lots) + (1 if current_lot else 0),
        )

    def join_auction(self, user: AppUser, auction_id: int) -> JoinAuctionResponse:
        self._sync_category(user)
        auction = self.store.auctions.get(auction_id)
        if not auction:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subasta no encontrada.")
        block_reason = self._can_view(user, auction)
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
            payment = self._pick_payment(user, auction, payload.payment_method_id)
            min_bid, max_bid = self._compute_bid_range(auction, lot)
            if payload.amount < min_bid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"La puja minima es {min_bid}.")
            if max_bid is not None and payload.amount > max_bid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"La puja maxima es {max_bid}.")
            if lot.current_bid is not None and payload.amount <= lot.current_bid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La oferta debe ser mayor a la mejor actual.")

            available = sum(item.available_amount for item in self._matching_verified_payments(user, auction.currency))
            commitment = self._current_commitment(user.id, auction.currency)
            if lot.current_bidder_id == user.id and lot.current_bid:
                commitment -= lot.current_bid
            if available and round(commitment + payload.amount, 2) > round(available, 2):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La oferta supera los fondos garantizados disponibles.")

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
            winning_bid = self.store.bids[lot.bid_ids[-1]] if lot.bid_ids else None
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
            winner = self.store.users[lot.current_bidder_id]
            winner.won_purchase_ids.append(purchase.id)
            if winning_bid:
                winning_bid.status = BidStatus.GANADORA
            self.notifications.create(
                winner.id,
                "Ganaste la subasta",
                f"El lote {lot.piece_number} es tuyo. Total a pagar: {purchase.total_amount} {auction.currency.value}.",
                NotificationKind.OPERACION,
            )
            self.notifications.create(
                lot.owner_user_id,
                "Lote vendido",
                f"Tu lote {lot.piece_number} fue vendido por {lot.current_bid} {auction.currency.value}.",
                NotificationKind.INFO,
            )
            return {"sold_to_company": False, "purchase_id": purchase.id}

        lot.sold = True
        lot.sold_to_company = True
        return {"sold_to_company": True, "purchase_id": None}

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
