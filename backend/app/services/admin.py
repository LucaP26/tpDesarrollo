from __future__ import annotations

from datetime import datetime

from app.core.time import utc_now
from fastapi import HTTPException, status

from app.domain.enums import AuctionState, ConsignmentStatus, NotificationKind, PaymentStatus
from app.domain.schemas import (
    AdminAuctionCreateRequest,
    AdminConsignmentReviewRequest,
    AdminDashboardResponse,
    AppUser,
    AuctionLotRecord,
    AuctionRecord,
    AuctionSummaryResponse,
    ConsignmentResponse,
    PaymentMethodResponse,
    UserProfileResponse,
)
from app.services.auctions import AuctionService
from app.services.notifications import NotificationService
from app.services.store import StoreBase
from app.services.user_categories import promote_user_category


class AdminService:
    def __init__(
        self,
        store: StoreBase,
        auctions: AuctionService,
        notifications: NotificationService,
    ) -> None:
        self.store = store
        self.auctions = auctions
        self.notifications = notifications

    def _user_profile(self, user: AppUser) -> UserProfileResponse:
        return UserProfileResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            full_name=f"{user.first_name} {user.last_name}",
            document_number=user.document_number,
            legal_address=user.legal_address,
            country_code=user.country_code,
            category=user.category,
            approved=user.approved,
            registration_stage=user.registration_stage,
            roles=user.roles,
            avatar_image_url=user.avatar_image_url,
        )

    def _auction_summary(self, auction: AuctionRecord) -> AuctionSummaryResponse:
        lots = self.auctions._ordered_lots(auction)
        current_lot = self.auctions._current_lot_record(auction)
        preview_lot = self.auctions._preview_lot_record(auction)
        return AuctionSummaryResponse(
            id=auction.id,
            title=auction.title,
            scheduled_at=datetime.combine(auction.scheduled_date, auction.scheduled_time),
            category=auction.category,
            currency=auction.currency,
            state=auction.state,
            location=auction.location,
            can_view_catalog=True,
            view_block_reason=None,
            can_bid=True,
            block_reason=None,
            current_lot_title=current_lot.title if current_lot else None,
            best_offer=current_lot.current_bid if current_lot else None,
            preview_lot_title=preview_lot.title if preview_lot else None,
            preview_image_url=preview_lot.image_urls[0] if preview_lot and preview_lot.image_urls else None,
            preview_base_price=preview_lot.base_price if preview_lot else None,
            total_lots=len(lots),
            remaining_lots=len([lot for lot in lots if not lot.sold]),
        )

    def dashboard(self) -> AdminDashboardResponse:
        pending_users = [self._user_profile(user) for user in self.store.users.values() if not user.approved]
        pending_payments = [
            PaymentMethodResponse(
                id=payment.id,
                type=payment.type,
                display_name=payment.display_name,
                currency=payment.currency,
                issuer_country=payment.issuer_country,
                available_amount=payment.available_amount,
                status=payment.status,
                last_four=payment.last_four,
                holder_first_name=payment.holder_first_name,
                holder_last_name=payment.holder_last_name,
                issuing_bank=payment.issuing_bank,
                expiration_date=payment.expiration_date,
            )
            for payment in self.store.payment_methods.values()
            if payment.status == PaymentStatus.PENDIENTE
        ]
        pending_consignments = [
            ConsignmentResponse(
                id=item.id,
                title=item.title,
                description=item.description,
                status=item.status,
                rejection_reason=item.rejection_reason,
                proposed_base_price=item.proposed_base_price,
                commission_rate=item.commission_rate,
                assigned_auction_id=item.assigned_auction_id,
                storage_location=item.storage_location,
                insurance_policy=item.insurance_policy,
                photos=item.photos,
            )
            for item in self.store.consignments.values()
            if item.status in {ConsignmentStatus.ENVIADA, ConsignmentStatus.EN_REVISION}
        ]
        return AdminDashboardResponse(
            pending_users=pending_users,
            pending_payments=pending_payments,
            pending_consignments=pending_consignments,
            auctions=[self._auction_summary(auction) for auction in sorted(self.store.auctions.values(), key=lambda item: (item.scheduled_date, item.scheduled_time))],
        )

    def approve_user(self, user_id: int, _category) -> UserProfileResponse:
        user = self.store.users.get(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
        user.approved = True
        promote_user_category(self.store, self.notifications, user)
        self.notifications.create(
            user.id,
            "Cuenta aprobada",
            f"La empresa aprobo tu registro con categoria {user.category.value}.",
            NotificationKind.OPERACION,
        )
        self.store.persist_all()
        return self._user_profile(user)

    def verify_payment(self, payment_id: int) -> PaymentMethodResponse:
        payment = self.store.payment_methods.get(payment_id)
        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medio de pago no encontrado.")
        payment.status = PaymentStatus.VERIFICADO
        payment.verified_at = utc_now()
        self.notifications.create(
            payment.user_id,
            "Medio de pago verificado",
            "Ya podes pujar en subastas compatibles con tu categoria.",
            NotificationKind.OPERACION,
        )
        self.store.persist_all()
        return PaymentMethodResponse(
            id=payment.id,
            type=payment.type,
            display_name=payment.display_name,
            currency=payment.currency,
            issuer_country=payment.issuer_country,
            available_amount=payment.available_amount,
            status=payment.status,
            last_four=payment.last_four,
            holder_first_name=payment.holder_first_name,
            holder_last_name=payment.holder_last_name,
            issuing_bank=payment.issuing_bank,
            expiration_date=payment.expiration_date,
        )

    def review_consignment(self, consignment_id: int, payload: AdminConsignmentReviewRequest) -> ConsignmentResponse:
        consignment = self.store.consignments.get(consignment_id)
        if not consignment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consignacion no encontrada.")
        if payload.approve:
            consignment.status = ConsignmentStatus.ACEPTADA
            consignment.proposed_base_price = payload.proposed_base_price
            consignment.commission_rate = payload.commission_rate
            consignment.assigned_auction_id = payload.assigned_auction_id
            consignment.storage_location = payload.storage_location
            consignment.insurance_policy = payload.insurance_policy
            message = "Tu bien fue aceptado y ya tiene propuesta comercial."
        else:
            consignment.status = ConsignmentStatus.RECHAZADA
            consignment.rejection_reason = payload.rejection_reason or "La empresa no avanzo con la pieza."
            message = consignment.rejection_reason
        self.notifications.create(
            consignment.owner_user_id,
            "Revision de consignacion",
            message,
            NotificationKind.INFO,
        )
        self.store.persist_all()
        return ConsignmentResponse(
            id=consignment.id,
            title=consignment.title,
            description=consignment.description,
            status=consignment.status,
            rejection_reason=consignment.rejection_reason,
            proposed_base_price=consignment.proposed_base_price,
            commission_rate=consignment.commission_rate,
            assigned_auction_id=consignment.assigned_auction_id,
            storage_location=consignment.storage_location,
            insurance_policy=consignment.insurance_policy,
            photos=consignment.photos,
        )

    def create_auction(self, payload: AdminAuctionCreateRequest) -> AuctionRecord:
        auction = AuctionRecord(
            id=self.store.next_id("auctions"),
            title=payload.title,
            scheduled_date=payload.scheduled_date,
            scheduled_time=payload.scheduled_time,
            category=payload.category,
            currency=payload.currency,
            state=AuctionState.ABIERTA,
            auctioneer_name=payload.auctioneer_name,
            location=payload.location,
            capacity=payload.capacity,
            has_storage=payload.has_storage,
            private_security=payload.private_security,
        )
        self.store.auctions[auction.id] = auction
        for lot_payload in payload.lots:
            lot = AuctionLotRecord(
                id=self.store.next_id("lots"),
                auction_id=auction.id,
                product_id=lot_payload.product_id,
                catalog_item_id=lot_payload.catalog_item_id,
                piece_number=lot_payload.piece_number,
                title=lot_payload.title,
                description=lot_payload.description,
                story=lot_payload.story,
                artist=lot_payload.artist,
                base_price=lot_payload.base_price,
                commission_rate=lot_payload.commission_rate,
                owner_user_id=lot_payload.owner_user_id,
                image_urls=lot_payload.image_urls,
            )
            self.store.lots[lot.id] = lot
            auction.lot_ids.append(lot.id)
        self.store.persist_all()
        return auction

    def close_auction(self, auction_id: int) -> dict:
        return self.auctions.close_auction(auction_id)

    def close_current_lot(self, auction_id: int) -> dict:
        return self.auctions.close_current_lot(auction_id)
