from __future__ import annotations

import sys
from datetime import date, time
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.domain.enums import AuctionState, Currency, RegistrationStage, UserCategory, UserRole
from app.domain.schemas import AppUser, AuctionRecord, PaymentMethodCreate
from app.services.auth import AuthService
from app.services.auctions import AuctionService
from app.services.notifications import NotificationService
from app.services.realtime import RealtimeManager
from app.services.store import StoreBase
from app.services.user_categories import category_for_activity


class FakeStore(StoreBase):
    def persist_all(self) -> None:
        return None


class FakeEmailService:
    class settings:
        password_reset_code_ttl_minutes = 15

    def send_password_reset_code(self, recipient: str, full_name: str, code: str) -> None:
        return None


def build_user() -> AppUser:
    return AppUser(
        id=1,
        email="tester@example.com",
        document_number="12345678",
        first_name="Test",
        last_name="User",
        legal_address="Calle 123",
        country_code=32,
        category=UserCategory.COMUN,
        approved=True,
        registration_stage=RegistrationStage.REGISTRO_COMPLETADO,
        roles=[UserRole.CLIENTE],
        password_hash="hash",
    )


def payment_payload(index: int) -> PaymentMethodCreate:
    return PaymentMethodCreate(
        type="cuenta_bancaria",
        display_name=f"Cuenta {index}",
        currency="ARS",
        issuer_country="AR",
        available_amount=100000 + index,
        holder_first_name="Test",
        holder_last_name="User",
        issuing_bank="Galicia",
    )


def build_auction(auction_id: int) -> AuctionRecord:
    return AuctionRecord(
        id=auction_id,
        title=f"Subasta {auction_id}",
        scheduled_date=date(2026, 3, 17),
        scheduled_time=time(18, 0),
        category=UserCategory.COMUN,
        currency=Currency.ARS,
        state=AuctionState.ABIERTA,
        auctioneer_name="Martillero",
        location="Buenos Aires",
        capacity=100,
        has_storage=True,
        private_security=True,
    )


def test_category_for_activity_respects_business_rules() -> None:
    assert category_for_activity(payment_count=0, auctions_joined=0) == UserCategory.COMUN
    assert category_for_activity(payment_count=3, auctions_joined=0) == UserCategory.ESPECIAL
    assert category_for_activity(payment_count=0, auctions_joined=1) == UserCategory.ESPECIAL
    assert category_for_activity(payment_count=5, auctions_joined=0) == UserCategory.PLATA
    assert category_for_activity(payment_count=0, auctions_joined=5) == UserCategory.PLATA
    assert category_for_activity(payment_count=2, auctions_joined=8) == UserCategory.ORO
    assert category_for_activity(payment_count=3, auctions_joined=10) == UserCategory.PLATINO


def test_user_category_promotes_with_payments_and_auction_participation() -> None:
    store = FakeStore()
    notifications = NotificationService(store)
    auth = AuthService(store, notifications, FakeEmailService())
    auctions = AuctionService(store, notifications, RealtimeManager())
    user = build_user()
    store.users[user.id] = user

    for index in range(1, 4):
        auth.create_payment_method(user, payment_payload(index))
    assert user.category == UserCategory.ESPECIAL

    for index in range(4, 6):
        auth.create_payment_method(user, payment_payload(index))
    assert user.category == UserCategory.PLATA

    for auction_id in range(1, 9):
        store.auctions[auction_id] = build_auction(auction_id)
        auctions.join_auction(user, auction_id)
        store.active_connections_by_user.pop(user.id, None)
    assert user.category == UserCategory.ORO

    for auction_id in range(9, 11):
        store.auctions[auction_id] = build_auction(auction_id)
        auctions.join_auction(user, auction_id)
        store.active_connections_by_user.pop(user.id, None)
    assert user.category == UserCategory.PLATINO
