from __future__ import annotations

from datetime import timedelta

from app.core.time import utc_now
from app.domain.enums import NotificationKind, PenaltyStatus
from app.domain.schemas import AppUser, PenaltyRecord, PurchaseRecord
from app.services.notifications import NotificationService
from app.services.store import StoreBase


COORDINATION_DEADLINE_HOURS = 48
SHIPPING_PENALTY_RATE = 0.10


def shipping_deadline_at(purchase: PurchaseRecord):
    return purchase.created_at + timedelta(hours=COORDINATION_DEADLINE_HOURS)


def shipping_penalty_amount(purchase: PurchaseRecord) -> float:
    return round(purchase.total_amount * SHIPPING_PENALTY_RATE, 2)


def has_started_shipping_coordination(store: StoreBase, purchase: PurchaseRecord) -> bool:
    return any(
        thread.purchase_id == purchase.id and thread.owner_user_id == purchase.buyer_user_id
        for thread in store.message_threads.values()
    )


def apply_overdue_shipping_coordination_penalties(
    store: StoreBase,
    notifications: NotificationService | None,
    user: AppUser,
) -> bool:
    changed = False
    now = utc_now()
    for purchase in store.purchases.values():
        if purchase.buyer_user_id != user.id:
            continue
        if has_started_shipping_coordination(store, purchase):
            continue
        if shipping_deadline_at(purchase) > now:
            continue

        marker = f"compra #{purchase.id}"
        if any(
            penalty.user_id == user.id and marker in penalty.reason.lower()
            for penalty in store.penalties.values()
        ):
            continue

        amount = shipping_penalty_amount(purchase)
        penalty = PenaltyRecord(
            id=store.next_id("penalties"),
            user_id=user.id,
            amount=amount,
            status=PenaltyStatus.ACTIVA,
            due_at=now + timedelta(hours=72),
            reason=(
                f"Multa por no iniciar la coordinacion de entrega de la compra #{purchase.id} "
                f"antes de las {COORDINATION_DEADLINE_HOURS} horas."
            ),
        )
        store.penalties[penalty.id] = penalty
        changed = True
        if notifications is not None:
            notifications.create(
                user.id,
                "Multa por entrega pendiente",
                (
                    f"No iniciaste la coordinacion de entrega de la compra #{purchase.id} "
                    f"antes de las {COORDINATION_DEADLINE_HOURS} horas. "
                    f"Se aplico una multa de {amount} {purchase.currency.value}."
                ),
                NotificationKind.ALERTA,
            )
    if changed:
        store.persist_all()
    return changed
