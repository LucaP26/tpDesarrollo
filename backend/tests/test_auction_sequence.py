from __future__ import annotations

import asyncio
import sys
from datetime import date, time
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.domain.enums import (
    AuctionState,
    Currency,
    PaymentStatus,
    PaymentType,
    RegistrationStage,
    UserCategory,
    UserRole,
)
from app.domain.schemas import AppUser, AuctionLotRecord, AuctionRecord, BidCreate, PaymentMethodRecord
from app.services.auctions import AuctionService
from app.services.notifications import NotificationService
from app.services.realtime import RealtimeManager
from app.services.store import StoreBase


class FakeStore(StoreBase):
    def persist_all(self) -> None:
        return None


def build_user() -> AppUser:
    return AppUser(
        id=1,
        email="coleccionista@example.com",
        document_number="12345678",
        first_name="Ada",
        last_name="Lovelace",
        legal_address="Calle 123",
        country_code=32,
        category=UserCategory.PLATINO,
        approved=True,
        registration_stage=RegistrationStage.REGISTRO_COMPLETADO,
        roles=[UserRole.CLIENTE],
        password_hash="hash",
    )


def build_user_two() -> AppUser:
    return AppUser(
        id=2,
        email="competidor@example.com",
        document_number="87654321",
        first_name="Grace",
        last_name="Hopper",
        legal_address="Avenida 456",
        country_code=32,
        category=UserCategory.PLATINO,
        approved=True,
        registration_stage=RegistrationStage.REGISTRO_COMPLETADO,
        roles=[UserRole.CLIENTE],
        password_hash="hash",
    )


def build_auction() -> AuctionRecord:
    return AuctionRecord(
        id=1,
        title="Noche de iconos",
        scheduled_date=date(2026, 4, 1),
        scheduled_time=time(20, 0),
        category=UserCategory.COMUN,
        currency=Currency.USD,
        state=AuctionState.ABIERTA,
        auctioneer_name="Martillero",
        location="Buenos Aires",
        capacity=120,
        has_storage=True,
        private_security=True,
    )


def build_lot(lot_id: int, auction_id: int, title: str, base_price: float) -> AuctionLotRecord:
    return AuctionLotRecord(
        id=lot_id,
        auction_id=auction_id,
        product_id=lot_id,
        catalog_item_id=lot_id,
        piece_number=f"L{lot_id:02d}",
        title=title,
        description=f"Descripcion de {title}",
        base_price=base_price,
        commission_rate=0.1,
        owner_user_id=99,
        image_urls=[f"https://cdn.example.com/{lot_id}.jpg"],
    )


def build_payment(user_id: int) -> PaymentMethodRecord:
    return PaymentMethodRecord(
        id=user_id,
        user_id=user_id,
        type=PaymentType.CUENTA_BANCARIA,
        display_name="Cuenta verificada",
        currency=Currency.USD,
        issuer_country="AR",
        available_amount=1_000_000,
        status=PaymentStatus.VERIFICADO,
        issuing_bank="Galicia",
    )


def build_service() -> tuple[FakeStore, AppUser, AuctionService]:
    store = FakeStore()
    notifications = NotificationService(store)
    service = AuctionService(store, notifications, RealtimeManager())
    user = build_user()
    competitor = build_user_two()
    auction = build_auction()
    lots = [
        build_lot(1, auction.id, "Rolex Daytona Paul Newman", 120_000),
        build_lot(2, auction.id, "Hermes Kelly Himalayan", 350_000),
        build_lot(3, auction.id, "Ferrari 275 GTB/4", 4_500_000),
    ]

    store.users[user.id] = user
    store.users[competitor.id] = competitor
    store.payment_methods[1] = build_payment(user.id)
    store.payment_methods[2] = build_payment(competitor.id)
    store.auctions[auction.id] = auction
    auction.lot_ids = [lot.id for lot in lots]
    for lot in lots:
        store.lots[lot.id] = lot
    store.active_connections_by_user[user.id] = auction.id
    return store, user, service


def test_summary_uses_first_lot_as_current_and_last_lot_as_preview() -> None:
    _, user, service = build_service()

    summary = service.list_auctions(user)[0]

    assert summary.current_lot_title == "Rolex Daytona Paul Newman"
    assert summary.preview_lot_title == "Ferrari 275 GTB/4"
    assert summary.preview_image_url == "https://cdn.example.com/3.jpg"
    assert summary.total_lots == 3
    assert summary.remaining_lots == 3


def test_cannot_bid_on_future_lot_when_another_is_in_exhibition() -> None:
    _, user, service = build_service()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.place_bid(user, 1, 2, BidCreate(amount=360_000)))

    assert exc_info.value.status_code == 400
    assert "actualmente en exhibicion" in exc_info.value.detail


def test_close_current_lot_advances_to_the_next_one() -> None:
    store, user, service = build_service()

    result = service.close_current_lot(1)

    assert result["closed_lot_id"] == 1
    assert result["next_lot_id"] == 2
    assert store.lots[1].sold is True
    assert store.lots[1].sold_to_company is True
    assert service._current_lot_record(store.auctions[1]).id == 2


def test_leaving_auction_removes_user_bid_and_restores_previous_leader() -> None:
    store, user, service = build_service()
    competitor = store.users[2]
    store.active_connections_by_user[competitor.id] = 1

    asyncio.run(service.place_bid(competitor, 1, 1, BidCreate(amount=121_200)))
    asyncio.run(service.place_bid(user, 1, 1, BidCreate(amount=122_400)))
    asyncio.run(service.place_bid(user, 1, 1, BidCreate(amount=123_600)))

    result = asyncio.run(service.leave_auction(user, 1))

    assert result.removed_bid_amount == 123_600
    assert result.new_current_bid == 121_200
    assert result.new_current_bidder_id == competitor.id
    assert store.lots[1].current_bid == 121_200
    assert store.lots[1].current_bidder_id == competitor.id
    assert store.active_connections_by_user.get(user.id) is None
    assert all(bid.user_id != user.id for bid in store.bids.values())
