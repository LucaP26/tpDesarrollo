from __future__ import annotations

from app.core.time import utc_now
from fastapi import HTTPException, status

from app.domain.enums import ConsignmentStatus, NotificationKind, UserRole
from app.domain.schemas import AppUser, ConsignmentCreate, ConsignmentRecord, ConsignmentResponse
from app.services.notifications import NotificationService
from app.services.store import StoreBase


class ConsignmentService:
    def __init__(self, store: StoreBase, notifications: NotificationService) -> None:
        self.store = store
        self.notifications = notifications

    def list_for_user(self, user: AppUser) -> list[ConsignmentResponse]:
        rows = [item for item in self.store.consignments.values() if item.owner_user_id == user.id]
        rows.sort(key=lambda item: item.created_at, reverse=True)
        return [
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
            for item in rows
        ]

    def create(self, user: AppUser, payload: ConsignmentCreate) -> ConsignmentResponse:
        if UserRole.DUENIO not in user.roles:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tu cuenta no esta habilitada para consignar bienes.")
        if len(payload.photos) < 6:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes cargar al menos 6 fotos del bien.")
        if not payload.declared_ownership or not payload.declared_legal_origin:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes declarar titularidad y origen licito.")

        consignment = ConsignmentRecord(
            id=self.store.next_id("consignments"),
            owner_user_id=user.id,
            title=payload.title,
            description=payload.description,
            story=payload.story,
            photos=payload.photos,
            declared_ownership=payload.declared_ownership,
            declared_legal_origin=payload.declared_legal_origin,
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
