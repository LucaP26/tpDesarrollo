from __future__ import annotations

from app.domain.enums import CATEGORY_ORDER, NotificationKind, UserCategory
from app.domain.schemas import AppUser
from app.services.notifications import NotificationService
from app.services.store import StoreBase


def category_for_activity(payment_count: int, auctions_joined: int) -> UserCategory:
    if auctions_joined >= 10 and payment_count >= 3:
        return UserCategory.PLATINO
    if auctions_joined >= 8:
        return UserCategory.ORO
    if payment_count >= 5 or auctions_joined >= 5:
        return UserCategory.PLATA
    if payment_count >= 3 or auctions_joined >= 1:
        return UserCategory.ESPECIAL
    return UserCategory.COMUN


def promote_user_category(store: StoreBase, notifications: NotificationService, user: AppUser) -> bool:
    payment_count = sum(1 for payment in store.payment_methods.values() if payment.user_id == user.id)
    auctions_joined = len(store.auction_attendance_by_user.get(user.id, set()))
    target_category = category_for_activity(payment_count, auctions_joined)

    if CATEGORY_ORDER[target_category] <= CATEGORY_ORDER[user.category]:
        return False

    user.category = target_category
    notifications.create(
        user.id,
        f"Tu categoria subio a {target_category.value.title()}",
        _promotion_message(target_category, payment_count, auctions_joined),
        NotificationKind.OPERACION,
    )
    return True


def _promotion_message(category: UserCategory, payment_count: int, auctions_joined: int) -> str:
    if category == UserCategory.PLATINO:
        return (
            f"Ahora eres categoria Platino: participaste en {auctions_joined} subastas "
            f"y tienes {payment_count} medios de pago cargados."
        )
    if category == UserCategory.ORO:
        return f"Ahora eres categoria Oro: ya participaste en {auctions_joined} subastas."
    if category == UserCategory.PLATA:
        if payment_count >= 5 and auctions_joined >= 5:
            return (
                f"Ahora eres categoria Plata: alcanzaste {payment_count} medios de pago "
                f"y {auctions_joined} subastas participadas."
            )
        if payment_count >= 5:
            return f"Ahora eres categoria Plata: ya tienes {payment_count} medios de pago cargados."
        return f"Ahora eres categoria Plata: ya participaste en {auctions_joined} subastas."
    if category == UserCategory.ESPECIAL:
        if payment_count >= 3 and auctions_joined >= 1:
            return (
                f"Ahora eres categoria Especial: ya tienes {payment_count} medios de pago "
                f"y participaste en {auctions_joined} subasta(s)."
            )
        if payment_count >= 3:
            return f"Ahora eres categoria Especial: ya tienes {payment_count} medios de pago cargados."
        return f"Ahora eres categoria Especial: ya participaste en {auctions_joined} subasta(s)."
    return "Tu categoria actual es Comun."
