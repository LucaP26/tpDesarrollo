from __future__ import annotations

from app.core.time import utc_now
from fastapi import HTTPException, status

from app.domain.schemas import (
    AppUser,
    ConsignmentRecord,
    CorrespondenceMessageRecord,
    CorrespondenceMessageResponse,
    MessageThreadRecord,
    MessageThreadResponse,
)
from app.services.consignment_rules import CONSIGNMENT_ADMIN_EMAIL
from app.services.notifications import NotificationService
from app.services.shipping_compliance import (
    COORDINATION_DEADLINE_HOURS,
    apply_overdue_shipping_coordination_penalties,
    shipping_deadline_at,
)
from app.services.store import StoreBase


class MessageService:
    AUTO_CONSIGNMENT_MESSAGE = "A"
    SHIPPING_SELLER_EMAIL = "m@gmail.com"

    def __init__(self, store: StoreBase, notifications: NotificationService | None = None) -> None:
        self.store = store
        self.notifications = notifications

    def open_for_consignment(self, consignment: ConsignmentRecord) -> MessageThreadRecord:
        admin = next(
            (item for item in self.store.users.values() if item.email.strip().lower() == CONSIGNMENT_ADMIN_EMAIL),
            None,
        )
        existing = next(
            (
                thread
                for thread in self.store.message_threads.values()
                if thread.consignment_id == consignment.id and thread.owner_user_id == consignment.owner_user_id
            ),
            None,
        )
        if existing:
            if admin and existing.seller_user_id is None:
                existing.seller_user_id = admin.id
            return existing

        now = utc_now()
        thread = MessageThreadRecord(
            id=self.store.next_id("message_threads"),
            owner_user_id=consignment.owner_user_id,
            consignment_id=consignment.id,
            seller_user_id=admin.id if admin else None,
            subject=f"Consignacion: {consignment.title}",
            created_at=now,
            updated_at=now,
        )
        self.store.message_threads[thread.id] = thread
        self._create_message(
            thread,
            sender_type="empresa",
            sender_user_id=None,
            body=self.AUTO_CONSIGNMENT_MESSAGE,
            created_at=now,
        )
        return thread

    def open_purchase_notice(self, owner_user_id: int, subject: str, body: str) -> MessageThreadRecord:
        now = utc_now()
        thread = MessageThreadRecord(
            id=self.store.next_id("message_threads"),
            owner_user_id=owner_user_id,
            consignment_id=None,
            subject=subject,
            created_at=now,
            updated_at=now,
        )
        self.store.message_threads[thread.id] = thread
        self._create_message(
            thread,
            sender_type="empresa",
            sender_user_id=None,
            body=body,
            created_at=now,
        )
        return thread

    def open_shipping_coordination(self, user: AppUser, purchase_id: int) -> MessageThreadResponse:
        purchase = self.store.purchases.get(purchase_id)
        if not purchase or purchase.buyer_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compra no encontrada.")
        apply_overdue_shipping_coordination_penalties(self.store, self.notifications, user)
        lot = self.store.lots.get(purchase.lot_id)
        if not lot:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item no encontrado.")
        seller = next((item for item in self.store.users.values() if item.email == self.SHIPPING_SELLER_EMAIL), None)
        seller_user_id = seller.id if seller else purchase.owner_user_id
        existing = next(
            (
                thread
                for thread in self.store.message_threads.values()
                if thread.purchase_id == purchase.id
                and thread.owner_user_id == user.id
                and thread.seller_user_id == seller_user_id
            ),
            None,
        )
        if existing:
            return self._thread_response(existing, include_messages=True)

        now = utc_now()
        thread = MessageThreadRecord(
            id=self.store.next_id("message_threads"),
            owner_user_id=user.id,
            consignment_id=None,
            purchase_id=purchase.id,
            seller_user_id=seller_user_id,
            subject=f"Envio: {lot.piece_number}",
            created_at=now,
            updated_at=now,
        )
        self.store.message_threads[thread.id] = thread
        seller_name = f"{seller.first_name} {seller.last_name}".strip() if seller else self.SHIPPING_SELLER_EMAIL
        self._create_message(
            thread,
            sender_type="vendedor",
            sender_user_id=seller_user_id,
            body=(
                f"Hola {user.first_name}, soy {seller_name}. "
                f"Coordinemos el envio de {lot.piece_number} - {lot.title}. "
                f"Esta coordinacion debe iniciarse antes del {shipping_deadline_at(purchase).isoformat()} "
                f"para evitar la multa por demora de {COORDINATION_DEADLINE_HOURS} horas."
            ),
            created_at=now,
        )
        self.store.persist_all()
        return self._thread_response(thread, include_messages=True)

    def list_for_user(self, user: AppUser) -> list[MessageThreadResponse]:
        rows = [
            thread
            for thread in self.store.message_threads.values()
            if thread.owner_user_id == user.id or thread.seller_user_id == user.id
        ]
        rows.sort(key=lambda item: item.updated_at, reverse=True)
        return [self._thread_response(thread, include_messages=False) for thread in rows]

    def get_for_user(self, user: AppUser, thread_id: int) -> MessageThreadResponse:
        thread = self._thread_for_user(user, thread_id)
        return self._thread_response(thread, include_messages=True)

    def reply_as_user(self, user: AppUser, thread_id: int, body: str) -> MessageThreadResponse:
        thread = self._thread_for_user(user, thread_id)
        sender_type = "vendedor" if thread.seller_user_id == user.id else "usuario"
        self._reply(thread, sender_type=sender_type, sender_user_id=user.id, body=body)
        self.store.persist_all()
        return self._thread_response(thread, include_messages=True)

    def list_for_admin(self) -> list[MessageThreadResponse]:
        rows = sorted(self.store.message_threads.values(), key=lambda item: item.updated_at, reverse=True)
        return [self._thread_response(thread, include_messages=True) for thread in rows]

    def reply_as_company(self, thread_id: int, body: str) -> MessageThreadResponse:
        thread = self.store.message_threads.get(thread_id)
        if not thread:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversacion no encontrada.")
        self._reply(thread, sender_type="empresa", sender_user_id=None, body=body)
        self.store.persist_all()
        return self._thread_response(thread, include_messages=True)

    def _thread_for_user(self, user: AppUser, thread_id: int) -> MessageThreadRecord:
        thread = self.store.message_threads.get(thread_id)
        if not thread or (thread.owner_user_id != user.id and thread.seller_user_id != user.id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversacion no encontrada.")
        return thread

    def _reply(
        self,
        thread: MessageThreadRecord,
        sender_type: str,
        sender_user_id: int | None,
        body: str,
    ) -> CorrespondenceMessageRecord:
        clean_body = body.strip()
        if not clean_body:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El mensaje no puede estar vacio.")
        message = self._create_message(
            thread,
            sender_type=sender_type,
            sender_user_id=sender_user_id,
            body=clean_body,
            created_at=utc_now(),
        )
        thread.updated_at = message.created_at
        return message

    def _create_message(
        self,
        thread: MessageThreadRecord,
        sender_type: str,
        sender_user_id: int | None,
        body: str,
        created_at,
    ) -> CorrespondenceMessageRecord:
        message = CorrespondenceMessageRecord(
            id=self.store.next_id("messages"),
            thread_id=thread.id,
            sender_type=sender_type,
            sender_user_id=sender_user_id,
            body=body,
            created_at=created_at,
        )
        self.store.messages[message.id] = message
        thread.updated_at = created_at
        return message

    def _thread_messages(self, thread_id: int) -> list[CorrespondenceMessageRecord]:
        rows = [message for message in self.store.messages.values() if message.thread_id == thread_id]
        rows.sort(key=lambda item: item.created_at)
        return rows

    def _message_response(self, message: CorrespondenceMessageRecord) -> CorrespondenceMessageResponse:
        return CorrespondenceMessageResponse(
            id=message.id,
            thread_id=message.thread_id,
            sender_type=message.sender_type,
            sender_user_id=message.sender_user_id,
            body=message.body,
            created_at=message.created_at,
        )

    def _thread_response(self, thread: MessageThreadRecord, include_messages: bool) -> MessageThreadResponse:
        messages = self._thread_messages(thread.id)
        owner = self.store.users.get(thread.owner_user_id)
        owner_name = f"{owner.first_name} {owner.last_name}".strip() if owner else None
        seller = self.store.users.get(thread.seller_user_id) if thread.seller_user_id is not None else None
        seller_name = f"{seller.first_name} {seller.last_name}".strip() if seller else None
        return MessageThreadResponse(
            id=thread.id,
            owner_user_id=thread.owner_user_id,
            owner_email=owner.email if owner else None,
            owner_name=owner_name or (owner.email if owner else None),
            consignment_id=thread.consignment_id,
            purchase_id=thread.purchase_id,
            seller_user_id=thread.seller_user_id,
            seller_email=seller.email if seller else None,
            seller_name=seller_name or (seller.email if seller else None),
            subject=thread.subject,
            status=thread.status,
            created_at=thread.created_at,
            updated_at=thread.updated_at,
            last_message=self._message_response(messages[-1]) if messages else None,
            messages=[self._message_response(message) for message in messages] if include_messages else [],
        )
