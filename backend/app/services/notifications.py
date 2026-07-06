from __future__ import annotations

from app.core.time import utc_now
from app.domain.enums import NotificationKind
from app.domain.schemas import MessageResponse, NotificationRecord, NotificationResponse
from app.services.store import StoreBase


class NotificationService:
    def __init__(self, store: StoreBase) -> None:
        self.store = store

    def create(
        self,
        user_id: int,
        title: str,
        message: str,
        kind: NotificationKind = NotificationKind.INFO,
    ) -> NotificationRecord:
        notification = NotificationRecord(
            id=self.store.next_id("notifications"),
            user_id=user_id,
            title=title,
            message=message,
            kind=kind,
            created_at=utc_now(),
        )
        self.store.notifications[notification.id] = notification
        return notification

    def list_for_user(self, user_id: int) -> list[NotificationResponse]:
        rows = [row for row in self.store.notifications.values() if row.user_id == user_id]
        rows.sort(key=lambda item: item.created_at, reverse=True)
        return [
            NotificationResponse(
                id=item.id,
                title=item.title,
                message=item.message,
                kind=item.kind,
                created_at=item.created_at,
                read=item.read,
            )
            for item in rows
        ]

    def mark_read(self, user_id: int, notification_id: int) -> MessageResponse | None:
        notification = self.store.notifications.get(notification_id)
        if not notification or notification.user_id != user_id:
            return None
        notification.read = True
        self.store.persist_all()
        return MessageResponse(message="Notificacion marcada como leida.")
