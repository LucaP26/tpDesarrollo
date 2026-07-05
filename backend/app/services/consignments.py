from __future__ import annotations

from app.core.time import utc_now
from fastapi import HTTPException, status

from app.domain.enums import ConsignmentStatus, NotificationKind, UserRole
from app.domain.schemas import AppUser, AuctionLotRecord, ConsignmentCreate, ConsignmentRecord, ConsignmentResponse
from app.services.notifications import NotificationService
from app.services.messages import MessageService
from app.services.store import StoreBase


class ConsignmentService:
    def __init__(self, store: StoreBase, notifications: NotificationService, messages: MessageService) -> None:
        self.store = store
        self.notifications = notifications
        self.messages = messages

    def _response(self, item: ConsignmentRecord) -> ConsignmentResponse:
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

    def _ensure_accepted_lot(self, consignment: ConsignmentRecord) -> None:
        if consignment.assigned_auction_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La empresa debe asignar una subasta antes de aceptar.")
        auction = self.store.auctions.get(consignment.assigned_auction_id)
        if not auction:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La subasta asignada no existe.")

        product_id = -300000000 - consignment.id
        existing_lot = next(
            (
                lot
                for lot in self.store.lots.values()
                if lot.product_id == product_id and lot.auction_id == auction.id
            ),
            None,
        )
        if existing_lot:
            existing_lot.title = consignment.title
            existing_lot.description = consignment.description
            existing_lot.story = consignment.story
            existing_lot.base_price = consignment.proposed_base_price or existing_lot.base_price
            existing_lot.commission_rate = consignment.commission_rate if consignment.commission_rate is not None else existing_lot.commission_rate
            existing_lot.image_urls = consignment.photos
            if existing_lot.id not in auction.lot_ids:
                auction.lot_ids.append(existing_lot.id)
            return

        catalog_item_id = -400000000 - consignment.id
        used_catalog_ids = {lot.catalog_item_id for lot in self.store.lots.values()}
        while catalog_item_id in used_catalog_ids:
            catalog_item_id -= 1

        lot = AuctionLotRecord(
            id=self.store.next_id("lots"),
            auction_id=auction.id,
            product_id=product_id,
            catalog_item_id=catalog_item_id,
            piece_number=f"CONS-{consignment.id}",
            title=consignment.title,
            description=consignment.description,
            story=consignment.story,
            artist=None,
            base_price=consignment.proposed_base_price or 0.02,
            commission_rate=consignment.commission_rate or 0.0,
            owner_user_id=consignment.owner_user_id,
            image_urls=consignment.photos,
        )
        self.store.lots[lot.id] = lot
        auction.lot_ids.append(lot.id)

    def list_for_user(self, user: AppUser) -> list[ConsignmentResponse]:
        rows = [item for item in self.store.consignments.values() if item.owner_user_id == user.id]
        rows.sort(key=lambda item: item.created_at, reverse=True)
        return [self._response(item) for item in rows]

    def create(self, user: AppUser, payload: ConsignmentCreate) -> ConsignmentResponse:
        if UserRole.DUENIO not in user.roles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tu cuenta no esta habilitada para consignar bienes.")
        if len(payload.photos) < 6:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes cargar al menos 6 fotos del bien.")
        if not payload.declared_ownership or not payload.declared_legal_origin or not payload.declared_return_charge_agreement:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debes declarar titularidad, origen licito y aceptacion de devolucion con cargo.",
            )
        if payload.item_count < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad de articulos debe ser al menos 1.")

        lawful_origin_evidence = [entry.strip() for entry in payload.lawful_origin_evidence if entry.strip()]
        collection_name = payload.collection_name.strip() if payload.collection_name and payload.collection_name.strip() else None
        payout_account = payload.payout_account.strip() if payload.payout_account and payload.payout_account.strip() else None

        consignment = ConsignmentRecord(
            id=self.store.next_id("consignments"),
            owner_user_id=user.id,
            title=payload.title,
            description=payload.description,
            story=payload.story,
            photos=payload.photos,
            declared_ownership=payload.declared_ownership,
            declared_legal_origin=payload.declared_legal_origin,
            declared_return_charge_agreement=payload.declared_return_charge_agreement,
            lawful_origin_evidence=lawful_origin_evidence,
            item_count=payload.item_count,
            collection_name=collection_name,
            payout_account=payout_account,
            status=ConsignmentStatus.ENVIADA,
            created_at=utc_now(),
        )
        self.store.consignments[consignment.id] = consignment
        user.consignment_ids.append(consignment.id)
        self.notifications.create(
            user.id,
            "Consignacion enviada",
            "La empresa revisara las fotos, la historia y la procedencia del bien.",
            NotificationKind.INFO,
        )
        self.messages.open_for_consignment(consignment)
        self.store.persist_all()
        return self._response(consignment)

    def decide_proposal(
        self,
        user: AppUser,
        consignment_id: int,
        accept: bool,
        payout_account: str | None = None,
    ) -> ConsignmentResponse:
        consignment = self.store.consignments.get(consignment_id)
        if not consignment or consignment.owner_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consignacion no encontrada.")
        if consignment.status != ConsignmentStatus.PENDIENTE_CONFIRMACION:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La consignacion no tiene una propuesta pendiente.")

        if accept:
            clean_payout_account = payout_account.strip() if payout_account and payout_account.strip() else None
            final_payout_account = clean_payout_account or consignment.payout_account
            if not final_payout_account:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Debes declarar una cuenta de liquidacion antes de aceptar la propuesta.",
                )
            self._ensure_accepted_lot(consignment)
            consignment.payout_account = final_payout_account
            consignment.status = ConsignmentStatus.ACEPTADA
            message = "Aceptaste la base, comision y condiciones. La pieza quedo lista para incluirse en subasta."
            kind = NotificationKind.OPERACION
        else:
            consignment.status = ConsignmentStatus.DEVUELTA
            consignment.rejection_reason = "El duenio no acepto el valor base o las comisiones propuestas."
            if not consignment.return_shipping_note:
                consignment.return_shipping_note = "Se procedera a la devolucion con gastos a cargo del usuario."
            message = "Rechazaste la propuesta comercial. La empresa coordinara la devolucion con los gastos informados."
            kind = NotificationKind.INFO

        self.notifications.create(
            consignment.owner_user_id,
            "Respuesta de consignacion",
            message,
            kind,
        )
        self.store.persist_all()
        return self._response(consignment)
