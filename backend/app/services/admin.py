from __future__ import annotations

from datetime import datetime, timedelta

from app.core.time import utc_now
from fastapi import HTTPException, status

from app.domain.enums import AuctionState, ConsignmentStatus, NotificationKind, PaymentStatus, RegistrationStage, UserCategory
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
    PasswordResetTokenRecord,
    PaymentMethodResponse,
    UserProfileResponse,
)
from app.services.auctions import AuctionService
from app.services.consignment_rules import (
    DEFAULT_CONSIGNMENT_BASE_PRICE,
    DEFAULT_CONSIGNMENT_COMMISSION_RATE,
    DEFAULT_CONSIGNMENT_STORAGE_LOCATION,
    INSPECTION_ADDRESS,
    REJECTION_RETURN_BUSINESS_DAYS,
    add_business_days,
)
from app.services.email import EmailService
from app.services.messages import MessageService
from app.services.notifications import NotificationService
from app.services.security import generate_token, hash_secret
from app.services.store import StoreBase
from app.services.user_categories import promote_user_category


class AdminService:
    def __init__(
        self,
        store: StoreBase,
        auctions: AuctionService,
        notifications: NotificationService,
        email: EmailService,
    ) -> None:
        self.store = store
        self.auctions = auctions
        self.notifications = notifications
        self.email = email

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
            gender=user.gender,
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
        auction = self.store.auctions.get(item.assigned_auction_id) if item.assigned_auction_id else None
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
            assigned_auction_title=auction.title if auction else None,
            assigned_auction_scheduled_at=datetime.combine(auction.scheduled_date, auction.scheduled_time) if auction else None,
            assigned_auction_location=auction.location if auction else None,
            assigned_auction_auctioneer_name=auction.auctioneer_name if auction else None,
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
        return MessageService(self.store, self.notifications).list_for_admin()

    def _default_auction_id(self) -> int | None:
        available = [
            auction
            for auction in self.store.auctions.values()
            if auction.state != AuctionState.CERRADA
        ]
        if not available:
            return None
        available.sort(key=lambda item: (item.scheduled_date, item.scheduled_time))
        return available[0].id

    def _open_consignment_review_chat(self, consignment: ConsignmentRecord, body: str) -> None:
        messages = MessageService(self.store, self.notifications)
        thread = messages.open_for_consignment(consignment)
        messages.reply_as_company(thread.id, body)

    def _clear_stale_setup_tokens(self, user_id: int) -> None:
        now = utc_now()
        self.store.password_reset_tokens = {
            token_id: token
            for token_id, token in self.store.password_reset_tokens.items()
            if token.used_at is None and token.expires_at >= now and token.user_id != user_id
        }

    def _issue_password_setup_token(self, user_id: int) -> tuple[int, str]:
        self._clear_stale_setup_tokens(user_id)
        raw_token = generate_token()
        now = utc_now()
        token_id = self.store.next_id("password_reset_tokens")
        self.store.password_reset_tokens[token_id] = PasswordResetTokenRecord(
            id=token_id,
            user_id=user_id,
            token_hash=hash_secret(raw_token),
            created_at=now,
            expires_at=now + timedelta(hours=self.email.settings.password_setup_link_ttl_hours),
            used_at=None,
        )
        return token_id, raw_token

    def approve_user(self, user_id: int, category: UserCategory) -> UserProfileResponse:
        user = self.store.users.get(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

        token_id: int | None = None
        if not user.password_hash:
            token_id, welcome_token = self._issue_password_setup_token(user.id)
            try:
                self.email.send_welcome_password_setup_email(
                    recipient=user.email,
                    full_name=f"{user.first_name} {user.last_name}".strip(),
                    gender=user.gender,
                    token=welcome_token,
                )
            except Exception:
                self.store.password_reset_tokens.pop(token_id, None)
                raise

        user.approved = True
        user.category = category
        if not user.password_hash:
            user.registration_stage = RegistrationStage.PRE_REGISTRO
        self.notifications.create(
            user.id,
            "Cuenta aprobada",
            f"La empresa aprobo tu registro con categoria {user.category.value}. Revisa tu correo para crear tu clave personal.",
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
        user = self.store.users.get(payment.user_id)
        if user:
            promote_user_category(self.store, self.notifications, user)
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
                consignment.inspection_address = INSPECTION_ADDRESS
            consignment.status = ConsignmentStatus.EN_REVISION
            message = (
                "La empresa esta interesada en revisar el bien. Envialo a la direccion indicada; "
                "si no es aceptado, la devolucion sera con cargo al usuario."
            )
        elif payload.approve is True:
            proposed_base_price = payload.proposed_base_price or DEFAULT_CONSIGNMENT_BASE_PRICE
            commission_rate = (
                payload.commission_rate
                if payload.commission_rate is not None
                else DEFAULT_CONSIGNMENT_COMMISSION_RATE
            )
            assigned_auction_id = payload.assigned_auction_id or self._default_auction_id()
            if proposed_base_price <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes informar un valor base valido.")
            if commission_rate < 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes informar una comision valida.")
            if assigned_auction_id is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes asignar una subasta futura.")
            if assigned_auction_id not in self.store.auctions:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La subasta asignada no existe.")

            auction = self.store.auctions[assigned_auction_id]
            consignment.status = ConsignmentStatus.PENDIENTE_CONFIRMACION
            consignment.rejection_reason = None
            consignment.proposed_base_price = proposed_base_price
            consignment.commission_rate = commission_rate
            consignment.assigned_auction_id = assigned_auction_id
            consignment.storage_location = payload.storage_location or DEFAULT_CONSIGNMENT_STORAGE_LOCATION
            consignment.insurance_policy = payload.insurance_policy or f"POL-CONS-{consignment.id:05d}"
            message = (
                "La empresa acepto el bien sujeto a tu confirmacion de precio base, comision y gastos. "
                f"Subasta asignada: {auction.title}, {auction.scheduled_date.isoformat()} "
                f"{auction.scheduled_time.strftime('%H:%M')}, {auction.location}."
            )
            self._open_consignment_review_chat(
                consignment,
                (
                    f"Tu item {consignment.title} fue aceptado para avanzar. "
                    f"Fecha y hora de subasta: {auction.scheduled_date.isoformat()} "
                    f"{auction.scheduled_time.strftime('%H:%M')}. "
                    f"Lugar: {auction.location}. "
                    f"Valor base: {proposed_base_price}. "
                    f"Comision: {commission_rate}. "
                    "Confirma desde Consignar si aceptas el valor base y las comisiones."
                ),
            )
        elif payload.approve is False:
            rejection_notified_at = utc_now()
            return_date = add_business_days(rejection_notified_at.date(), REJECTION_RETURN_BUSINESS_DAYS)
            consignment.status = ConsignmentStatus.RECHAZADA
            consignment.rejection_reason = payload.rejection_reason or "La empresa no avanzo con la pieza."
            consignment.return_shipping_note = (
                f"El item volvera al punto de retiro el {return_date.isoformat()}, "
                f"{REJECTION_RETURN_BUSINESS_DAYS} dias habiles despues de esta notificacion."
            )
            message = (
                "Tu item a subastar ha sido rechazado por la empresa. "
                f"{consignment.return_shipping_note} Motivo: {consignment.rejection_reason}"
            )
            self._open_consignment_review_chat(consignment, message)
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
