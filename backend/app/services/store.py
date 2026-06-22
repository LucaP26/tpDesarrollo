from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from contextlib import contextmanager
from datetime import date
from typing import Iterator

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.db.models import (
    AppAttendanceRow,
    AppAuctionRow,
    AppBidRow,
    AppConsignmentRow,
    AppLotRow,
    AppNotificationRow,
    AppPasswordResetTokenRow,
    AppPaymentMethodRow,
    AppPenaltyRow,
    AppPurchaseRow,
    AppUserRow,
    AppWatchlistRow,
)
from app.db.sqlserver import ensure_database_ready
from app.domain.enums import (
    AuctionState,
    BidStatus,
    ConsignmentStatus,
    Currency,
    NotificationKind,
    PaymentStatus,
    PaymentType,
    PenaltyStatus,
    RegistrationStage,
    UserCategory,
    UserRole,
)
from app.domain.schemas import (
    AppUser,
    AuctionLotRecord,
    AuctionRecord,
    BidRecord,
    ConsignmentRecord,
    NotificationRecord,
    PenaltyRecord,
    PasswordResetTokenRecord,
    PaymentMethodRecord,
    PurchaseRecord,
    WatchlistRecord,
)


class StoreBase:
    def __init__(self) -> None:
        self._init_state()

    def _init_state(self) -> None:
        self.users: dict[int, AppUser] = {}
        self.payment_methods: dict[int, PaymentMethodRecord] = {}
        self.auctions: dict[int, AuctionRecord] = {}
        self.lots: dict[int, AuctionLotRecord] = {}
        self.bids: dict[int, BidRecord] = {}
        self.notifications: dict[int, NotificationRecord] = {}
        self.watchlist: dict[tuple[int, int], WatchlistRecord] = {}
        self.consignments: dict[int, ConsignmentRecord] = {}
        self.purchases: dict[int, PurchaseRecord] = {}
        self.penalties: dict[int, PenaltyRecord] = {}
        self.password_reset_tokens: dict[int, PasswordResetTokenRecord] = {}
        self.tokens: dict[str, int] = {}
        self.active_connections_by_user: dict[int, int] = {}
        self.auction_attendance_by_user: dict[int, set[int]] = defaultdict(set)
        self.id_sequences = defaultdict(int)
        self._auction_locks: dict[int, asyncio.Lock] = {}

    def next_id(self, scope: str) -> int:
        self.id_sequences[scope] += 1
        return self.id_sequences[scope]

    def lock_for_auction(self, auction_id: int) -> asyncio.Lock:
        if auction_id not in self._auction_locks:
            self._auction_locks[auction_id] = asyncio.Lock()
        return self._auction_locks[auction_id]

    def persist_all(self) -> None:
        raise NotImplementedError

    def _rebuild_relationships(self) -> None:
        for user in self.users.values():
            user.payment_method_ids = []
            user.won_purchase_ids = []
            user.consignment_ids = []
        for auction in self.auctions.values():
            auction.lot_ids = []
        for lot in self.lots.values():
            lot.bid_ids = []

        for payment in self.payment_methods.values():
            user = self.users.get(payment.user_id)
            if user:
                user.payment_method_ids.append(payment.id)
        for purchase in self.purchases.values():
            user = self.users.get(purchase.buyer_user_id)
            if user:
                user.won_purchase_ids.append(purchase.id)
        for consignment in self.consignments.values():
            user = self.users.get(consignment.owner_user_id)
            if user:
                user.consignment_ids.append(consignment.id)
        for lot in self.lots.values():
            auction = self.auctions.get(lot.auction_id)
            if auction:
                auction.lot_ids.append(lot.id)
        for bid in self.bids.values():
            lot = self.lots.get(bid.lot_id)
            if lot:
                lot.bid_ids.append(bid.id)

        for auction in self.auctions.values():
            auction.lot_ids.sort()
        for lot in self.lots.values():
            lot.bid_ids.sort()
        for user in self.users.values():
            user.payment_method_ids.sort()
            user.won_purchase_ids.sort()
            user.consignment_ids.sort()

    def _reset_sequences_from_state(self) -> None:
        self.id_sequences["users"] = max(self.users.keys(), default=0)
        self.id_sequences["payments"] = max(self.payment_methods.keys(), default=0)
        self.id_sequences["auctions"] = max(self.auctions.keys(), default=0)
        self.id_sequences["lots"] = max(self.lots.keys(), default=0)
        self.id_sequences["bids"] = max(self.bids.keys(), default=0)
        self.id_sequences["notifications"] = max(self.notifications.keys(), default=0)
        self.id_sequences["consignments"] = max(self.consignments.keys(), default=0)
        self.id_sequences["purchases"] = max(self.purchases.keys(), default=0)
        self.id_sequences["penalties"] = max(self.penalties.keys(), default=0)
        self.id_sequences["password_reset_tokens"] = max(self.password_reset_tokens.keys(), default=0)
        attendance_ids = [auction_id for auctions in self.auction_attendance_by_user.values() for auction_id in auctions]
        self.id_sequences["attendance"] = len(attendance_ids)

class SqlServerStore(StoreBase):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.engine = ensure_database_ready(settings)
        self.session_factory = sessionmaker(bind=self.engine, class_=Session, expire_on_commit=False, future=True)
        super().__init__()
        self._load_from_database()

    @contextmanager
    def session(self) -> Iterator[Session]:
        session = self.session_factory()
        try:
            yield session
        finally:
            session.close()

    def _load_from_database(self) -> None:
        self.users = {}
        self.payment_methods = {}
        self.auctions = {}
        self.lots = {}
        self.bids = {}
        self.notifications = {}
        self.watchlist = {}
        self.consignments = {}
        self.purchases = {}
        self.penalties = {}
        self.password_reset_tokens = {}
        self.auction_attendance_by_user = defaultdict(set)

        with self.session() as session:
            for row in session.scalars(select(AppUserRow)).all():
                self.users[row.id] = AppUser(
                    id=row.id,
                    email=row.email,
                    document_number=row.document_number,
                    first_name=row.first_name,
                    last_name=row.last_name,
                    gender=row.gender or "otro",
                    birth_date=date.fromisoformat(row.birth_date) if row.birth_date else None,
                    legal_address=row.legal_address,
                    country_code=row.country_code,
                    category=UserCategory(row.category),
                    approved=row.approved,
                    registration_stage=RegistrationStage(row.registration_stage),
                    roles=[UserRole(role) for role in json.loads(row.roles_json)],
                    password_hash=row.password_hash,
                    document_front_image_url=row.document_front_image_url,
                    document_back_image_url=row.document_back_image_url,
                    avatar_image_url=row.avatar_image_url,
                )
            for row in session.scalars(select(AppPaymentMethodRow)).all():
                self.payment_methods[row.id] = PaymentMethodRecord(
                    id=row.id,
                    user_id=row.user_id,
                    type=PaymentType(row.type),
                    display_name=row.display_name,
                    currency=Currency(row.currency),
                    issuer_country=row.issuer_country,
                    available_amount=float(row.available_amount),
                    status=PaymentStatus(row.status),
                    last_four=row.last_four,
                    holder_first_name=row.holder_first_name,
                    holder_last_name=row.holder_last_name,
                    issuing_bank=row.issuing_bank,
                    expiration_date=row.expiration_date,
                    verified_at=row.verified_at,
                )
            for row in session.scalars(select(AppAuctionRow)).all():
                self.auctions[row.id] = AuctionRecord(
                    id=row.id,
                    title=row.title,
                    scheduled_date=row.scheduled_date,
                    scheduled_time=row.scheduled_time,
                    category=UserCategory(row.category),
                    currency=Currency(row.currency),
                    state=AuctionState(row.state),
                    auctioneer_name=row.auctioneer_name,
                    location=row.location,
                    capacity=row.capacity,
                    has_storage=row.has_storage,
                    private_security=row.private_security,
                )
            for row in session.scalars(select(AppLotRow)).all():
                self.lots[row.id] = AuctionLotRecord(
                    id=row.id,
                    auction_id=row.auction_id,
                    product_id=row.product_id,
                    catalog_item_id=row.catalog_item_id,
                    piece_number=row.piece_number,
                    title=row.title,
                    description=row.description,
                    story=row.story,
                    artist=row.artist,
                    base_price=float(row.base_price),
                    commission_rate=float(row.commission_rate),
                    owner_user_id=row.owner_user_id,
                    image_urls=json.loads(row.image_urls_json),
                    current_bid=float(row.current_bid) if row.current_bid is not None else None,
                    current_bidder_id=row.current_bidder_id,
                    bidding_started_at=row.bidding_started_at,
                    bid_deadline_at=row.bid_deadline_at,
                    sold=row.sold,
                    sold_to_company=row.sold_to_company,
                )
            for row in session.scalars(select(AppBidRow)).all():
                self.bids[row.id] = BidRecord(
                    id=row.id,
                    auction_id=row.auction_id,
                    lot_id=row.lot_id,
                    user_id=row.user_id,
                    amount=float(row.amount),
                    status=BidStatus(row.status),
                    created_at=row.created_at,
                    payment_method_id=row.payment_method_id,
                )
            for row in session.scalars(select(AppNotificationRow)).all():
                self.notifications[row.id] = NotificationRecord(
                    id=row.id,
                    user_id=row.user_id,
                    title=row.title,
                    message=row.message,
                    kind=NotificationKind(row.kind),
                    created_at=row.created_at,
                    read=row.read,
                )
            for row in session.scalars(select(AppWatchlistRow)).all():
                self.watchlist[(row.user_id, row.auction_id)] = WatchlistRecord(
                    user_id=row.user_id,
                    auction_id=row.auction_id,
                    created_at=row.created_at,
                )
            for row in session.scalars(select(AppConsignmentRow)).all():
                self.consignments[row.id] = ConsignmentRecord(
                    id=row.id,
                    owner_user_id=row.owner_user_id,
                    title=row.title,
                    description=row.description,
                    story=row.story,
                    photos=json.loads(row.photos_json),
                    declared_ownership=row.declared_ownership,
                    declared_legal_origin=row.declared_legal_origin,
                    status=ConsignmentStatus(row.status),
                    created_at=row.created_at,
                    rejection_reason=row.rejection_reason,
                    proposed_base_price=float(row.proposed_base_price) if row.proposed_base_price is not None else None,
                    commission_rate=float(row.commission_rate) if row.commission_rate is not None else None,
                    assigned_auction_id=row.assigned_auction_id,
                    storage_location=row.storage_location,
                    insurance_policy=row.insurance_policy,
                )
            for row in session.scalars(select(AppPurchaseRow)).all():
                self.purchases[row.id] = PurchaseRecord(
                    id=row.id,
                    auction_id=row.auction_id,
                    lot_id=row.lot_id,
                    buyer_user_id=row.buyer_user_id,
                    owner_user_id=row.owner_user_id,
                    hammer_price=float(row.hammer_price),
                    commission_amount=float(row.commission_amount),
                    shipping_amount=float(row.shipping_amount),
                    total_amount=float(row.total_amount),
                    currency=Currency(row.currency),
                    payment_method_id=row.payment_method_id,
                    paid=row.paid,
                    created_at=row.created_at,
                )
            for row in session.scalars(select(AppPenaltyRow)).all():
                self.penalties[row.id] = PenaltyRecord(
                    id=row.id,
                    user_id=row.user_id,
                    amount=float(row.amount),
                    status=PenaltyStatus(row.status),
                    due_at=row.due_at,
                    reason=row.reason,
                )
            for row in session.scalars(select(AppPasswordResetTokenRow)).all():
                self.password_reset_tokens[row.id] = PasswordResetTokenRecord(
                    id=row.id,
                    user_id=row.user_id,
                    token_hash=row.token_hash,
                    created_at=row.created_at,
                    expires_at=row.expires_at,
                    used_at=row.used_at,
                )
            for row in session.scalars(select(AppAttendanceRow)).all():
                self.auction_attendance_by_user[row.user_id].add(row.auction_id)

        self._rebuild_relationships()
        self._reset_sequences_from_state()

    def persist_all(self) -> None:
        self._rebuild_relationships()
        with self.session() as session:
            for model in (
                AppAttendanceRow,
                AppPenaltyRow,
                AppPasswordResetTokenRow,
                AppPurchaseRow,
                AppNotificationRow,
                AppWatchlistRow,
                AppBidRow,
                AppConsignmentRow,
                AppLotRow,
                AppAuctionRow,
                AppPaymentMethodRow,
                AppUserRow,
            ):
                session.execute(delete(model))

            session.add_all(
                [
                    AppUserRow(
                        id=user.id,
                        email=user.email,
                        document_number=user.document_number,
                        first_name=user.first_name,
                        last_name=user.last_name,
                        gender=user.gender,
                        birth_date=user.birth_date.isoformat() if user.birth_date is not None else None,
                        legal_address=user.legal_address,
                        country_code=user.country_code,
                        category=user.category.value,
                        approved=user.approved,
                        registration_stage=user.registration_stage.value,
                        roles_json=json.dumps([role.value for role in user.roles]),
                        password_hash=user.password_hash,
                        document_front_image_url=user.document_front_image_url,
                        document_back_image_url=user.document_back_image_url,
                        avatar_image_url=user.avatar_image_url,
                    )
                    for user in self.users.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppPaymentMethodRow(
                        id=payment.id,
                        user_id=payment.user_id,
                        type=payment.type.value,
                        display_name=payment.display_name,
                        currency=payment.currency.value,
                        issuer_country=payment.issuer_country,
                        available_amount=payment.available_amount,
                        status=payment.status.value,
                        last_four=payment.last_four,
                        holder_first_name=payment.holder_first_name,
                        holder_last_name=payment.holder_last_name,
                        issuing_bank=payment.issuing_bank,
                        expiration_date=payment.expiration_date,
                        verified_at=payment.verified_at,
                    )
                    for payment in self.payment_methods.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppAuctionRow(
                        id=auction.id,
                        title=auction.title,
                        scheduled_date=auction.scheduled_date,
                        scheduled_time=auction.scheduled_time,
                        category=auction.category.value,
                        currency=auction.currency.value,
                        state=auction.state.value,
                        auctioneer_name=auction.auctioneer_name,
                        location=auction.location,
                        capacity=auction.capacity,
                        has_storage=auction.has_storage,
                        private_security=auction.private_security,
                    )
                    for auction in self.auctions.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppLotRow(
                        id=lot.id,
                        auction_id=lot.auction_id,
                        product_id=lot.product_id,
                        catalog_item_id=lot.catalog_item_id,
                        piece_number=lot.piece_number,
                        title=lot.title,
                        description=lot.description,
                        story=lot.story,
                        artist=lot.artist,
                        base_price=lot.base_price,
                        commission_rate=lot.commission_rate,
                        owner_user_id=lot.owner_user_id,
                        image_urls_json=json.dumps(lot.image_urls),
                        current_bid=lot.current_bid,
                        current_bidder_id=lot.current_bidder_id,
                        bidding_started_at=lot.bidding_started_at,
                        bid_deadline_at=lot.bid_deadline_at,
                        sold=lot.sold,
                        sold_to_company=lot.sold_to_company,
                    )
                    for lot in self.lots.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppBidRow(
                        id=bid.id,
                        auction_id=bid.auction_id,
                        lot_id=bid.lot_id,
                        user_id=bid.user_id,
                        amount=bid.amount,
                        status=bid.status.value,
                        created_at=bid.created_at,
                        payment_method_id=bid.payment_method_id,
                    )
                    for bid in self.bids.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppNotificationRow(
                        id=item.id,
                        user_id=item.user_id,
                        title=item.title,
                        message=item.message,
                        kind=item.kind.value,
                        created_at=item.created_at,
                        read=item.read,
                    )
                    for item in self.notifications.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppWatchlistRow(
                        user_id=item.user_id,
                        auction_id=item.auction_id,
                        created_at=item.created_at,
                    )
                    for item in self.watchlist.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppConsignmentRow(
                        id=item.id,
                        owner_user_id=item.owner_user_id,
                        title=item.title,
                        description=item.description,
                        story=item.story,
                        photos_json=json.dumps(item.photos),
                        declared_ownership=item.declared_ownership,
                        declared_legal_origin=item.declared_legal_origin,
                        status=item.status.value,
                        created_at=item.created_at,
                        rejection_reason=item.rejection_reason,
                        proposed_base_price=item.proposed_base_price,
                        commission_rate=item.commission_rate,
                        assigned_auction_id=item.assigned_auction_id,
                        storage_location=item.storage_location,
                        insurance_policy=item.insurance_policy,
                    )
                    for item in self.consignments.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppPurchaseRow(
                        id=item.id,
                        auction_id=item.auction_id,
                        lot_id=item.lot_id,
                        buyer_user_id=item.buyer_user_id,
                        owner_user_id=item.owner_user_id,
                        hammer_price=item.hammer_price,
                        commission_amount=item.commission_amount,
                        shipping_amount=item.shipping_amount,
                        total_amount=item.total_amount,
                        currency=item.currency.value,
                        payment_method_id=item.payment_method_id,
                        paid=item.paid,
                        created_at=item.created_at,
                    )
                    for item in self.purchases.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppPenaltyRow(
                        id=item.id,
                        user_id=item.user_id,
                        amount=item.amount,
                        status=item.status.value,
                        due_at=item.due_at,
                        reason=item.reason,
                    )
                    for item in self.penalties.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppPasswordResetTokenRow(
                        id=item.id,
                        user_id=item.user_id,
                        token_hash=item.token_hash,
                        created_at=item.created_at,
                        expires_at=item.expires_at,
                        used_at=item.used_at,
                    )
                    for item in self.password_reset_tokens.values()
                ]
            )
            session.flush()
            attendance_rows = []
            attendance_id = 1
            for user_id, auction_ids in self.auction_attendance_by_user.items():
                for auction_id in sorted(auction_ids):
                    attendance_rows.append(
                        AppAttendanceRow(
                            id=attendance_id,
                            user_id=user_id,
                            auction_id=auction_id,
                        )
                    )
                    attendance_id += 1
            session.add_all(attendance_rows)
            session.commit()
        self._reset_sequences_from_state()
