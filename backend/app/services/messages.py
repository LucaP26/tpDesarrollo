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
from app.services.store import StoreBase


class MessageService:
    AUTO_CONSIGNMENT_MESSAGE = "A"

    def __init__(self, store: StoreBase) -> None:
        self.store = store

    def open_for_consignment(self, consignment: ConsignmentRecord) -> MessageThreadRecord:
        existing = next(
            (
                thread
                for thread in self.store.message_threads.values()
                if thread.consignment_id == consignment.id and thread.owner_user_id == consignment.owner_user_id
            ),
            None,
        )
        if existing:
            return existing

        now = utc_now()
        thread = MessageThreadRecord(
            id=self.store.next_id("message_threads"),
            owner_user_id=consignment.owner_user_id,
            consignment_id=consignment.id,
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

    def list_for_user(self, user: AppUser) -> list[MessageThreadResponse]:
        rows = [thread for thread in self.store.message_threads.values() if thread.owner_user_id == user.id]
        rows.sort(key=lambda item: item.updated_at, reverse=True)
        return [self._thread_response(thread, include_messages=False) for thread in rows]

    def get_for_user(self, user: AppUser, thread_id: int) -> MessageThreadResponse:
        thread = self._thread_for_user(user, thread_id)
        return self._thread_response(thread, include_messages=True)

    def reply_as_user(self, user: AppUser, thread_id: int, body: str) -> MessageThreadResponse:
        thread = self._thread_for_user(user, thread_id)
        self._reply(thread, sender_type="usuario", sender_user_id=user.id, body=body)
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
        if not thread or thread.owner_user_id != user.id:
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
        return MessageThreadResponse(
            id=thread.id,
            consignment_id=thread.consignment_id,
            subject=thread.subject,
            status=thread.status,
            created_at=thread.created_at,
            updated_at=thread.updated_at,
            last_message=self._message_response(messages[-1]) if messages else None,
            messages=[self._message_response(message) for message in messages] if include_messages else [],
        )
