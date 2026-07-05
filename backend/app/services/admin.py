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
    ConsignmentRecord,
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
            auctioneer_name=auction.auctioneer_name,
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

    def _consignment_response(self, item: ConsignmentRecord) -> ConsignmentResponse:
        return ConsignmentResponse(
            id=item.id,
            title=item.title,
            description=item.description,
            story=item.story,
            status=item.status,
            declared_ownership=item.declared_ownership,
            declared_legal_origin=item.declared_legal_origin,
            declared_return_charge_agreement=item.declared_return_charge_agreement,
            lawful_origin_evidence=item.lawful_origin_evidence,
            created_at=item.created_at,
            rejection_reason=item.rejection_reason,
            proposed_base_price=item.proposed_base_price,
            commission_rate=item.commission_rate,
            assigned_auction_id=item.assigned_auction_id,
            storage_location=item.storage_location,
            insurance_policy=item.insurance_policy,
            inspection_address=item.inspection_address,
            return_shipping_cost=item.return_shipping_cost,
            return_shipping_note=item.return_shipping_note,
            origin_doubt_reported=item.origin_doubt_reported,
            origin_doubt_notes=item.origin_doubt_notes,
            authority_reported_at=item.authority_reported_at,
            item_count=item.item_count,
            collection_name=item.collection_name,
            payout_account=item.payout_account,
            photos=item.photos,
        )

    def _apply_consignment_review_details(
        self,
        consignment: ConsignmentRecord,
        payload: AdminConsignmentReviewRequest,
    ) -> None:
        if payload.return_shipping_cost is not None and payload.return_shipping_cost < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El costo de devolucion no puede ser negativo.")

        consignment.inspection_address = (
            payload.inspection_address.strip()
            if payload.inspection_address and payload.inspection_address.strip()
            else consignment.inspection_address
        )
        if payload.return_shipping_cost is not None:
            consignment.return_shipping_cost = payload.return_shipping_cost
        consignment.return_shipping_note = (
            payload.return_shipping_note.strip()
            if payload.return_shipping_note and payload.return_shipping_note.strip()
            else consignment.return_shipping_note
        )
        if payload.origin_doubt_notes and payload.origin_doubt_notes.strip():
            consignment.origin_doubt_notes = payload.origin_doubt_notes.strip()
        if payload.origin_doubt_reported:
            consignment.origin_doubt_reported = True
            if consignment.authority_reported_at is None:
                consignment.authority_reported_at = utc_now()

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
            self._consignment_response(item)
            for item in self.store.consignments.values()
            if item.status in {
                ConsignmentStatus.ENVIADA,
                ConsignmentStatus.EN_REVISION,
                ConsignmentStatus.PENDIENTE_CONFIRMACION,
            }
        ]
        return AdminDashboardResponse(
            pending_users=pending_users,
            pending_payments=pending_payments,
            pending_consignments=pending_consignments,
            message_threads=self.store_message_threads(),
            auctions=[self._auction_summary(auction) for auction in sorted(self.store.auctions.values(), key=lambda item: (item.scheduled_date, item.scheduled_time))],
        )

    def store_message_threads(self):
        from app.services.messages import MessageService

        return MessageService(self.store).list_for_admin()

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

        self._apply_consignment_review_details(consignment, payload)

        if payload.request_inspection:
            if not consignment.inspection_address:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes indicar la direccion de inspeccion.")
            consignment.status = ConsignmentStatus.EN_REVISION
            message = (
                "La empresa esta interesada en revisar el bien. Envialo a la direccion indicada; "
                "si no es aceptado, la devolucion sera con cargo al usuario."
            )
        elif payload.approve is True:
            if payload.proposed_base_price is None or payload.proposed_base_price <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes informar un valor base valido.")
            if payload.commission_rate is None or payload.commission_rate < 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes informar una comision valida.")
            if payload.assigned_auction_id is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes asignar una subasta futura.")
            if payload.assigned_auction_id not in self.store.auctions:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La subasta asignada no existe.")

            auction = self.store.auctions[payload.assigned_auction_id]
            consignment.status = ConsignmentStatus.PENDIENTE_CONFIRMACION
            consignment.rejection_reason = None
            consignment.proposed_base_price = payload.proposed_base_price
            consignment.commission_rate = payload.commission_rate
            consignment.assigned_auction_id = payload.assigned_auction_id
            consignment.storage_location = payload.storage_location
            consignment.insurance_policy = payload.insurance_policy
            message = (
                "La empresa acepto el bien sujeto a tu confirmacion de precio base, comision y gastos. "
                f"Subasta asignada: {auction.title}, {auction.scheduled_date.isoformat()} "
                f"{auction.scheduled_time.strftime('%H:%M')}, {auction.location}."
            )
        elif payload.approve is False:
            consignment.status = ConsignmentStatus.RECHAZADA
            consignment.rejection_reason = payload.rejection_reason or "La empresa no avanzo con la pieza."
            if not consignment.return_shipping_note:
                consignment.return_shipping_note = "El bien sera devuelto con gastos a cargo del usuario."
            message = consignment.rejection_reason
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes solicitar inspeccion, aprobar o rechazar la consignacion.")

        self.notifications.create(
            consignment.owner_user_id,
            "Revision de consignacion",
            message,
            NotificationKind.INFO,
        )
        self.store.persist_all()
        return self._consignment_response(consignment)

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
