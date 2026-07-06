from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base declarative model for app runtime tables."""


class AppUserRow(Base):
    __tablename__ = "app_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    email: Mapped[str] = mapped_column(String(250), unique=True, nullable=False)
    document_number: Mapped[str] = mapped_column(String(20), nullable=False)
    first_name: Mapped[str] = mapped_column(String(150), nullable=False)
    last_name: Mapped[str] = mapped_column(String(150), nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    birth_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    legal_address: Mapped[str] = mapped_column(String(350), nullable=False)
    country_code: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    approved: Mapped[bool] = mapped_column(Boolean, nullable=False)
    registration_stage: Mapped[str] = mapped_column(String(40), nullable=False)
    roles_json: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(500), nullable=True)
    document_front_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_back_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)


class AppPasswordResetTokenRow(Base):
    __tablename__ = "app_password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AppPaymentMethodRow(Base):
    __tablename__ = "app_payment_methods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    display_name: Mapped[str] = mapped_column(String(250), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    issuer_country: Mapped[str] = mapped_column(String(10), nullable=False)
    available_amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    last_four: Mapped[str | None] = mapped_column(String(10), nullable=True)
    holder_first_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    holder_last_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    issuing_bank: Mapped[str | None] = mapped_column(String(120), nullable=True)
    expiration_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AppAuctionRow(Base):
    __tablename__ = "app_auctions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    scheduled_time: Mapped[time] = mapped_column(Time, nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False)
    auctioneer_name: Mapped[str] = mapped_column(String(250), nullable=False)
    location: Mapped[str] = mapped_column(String(350), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    has_storage: Mapped[bool] = mapped_column(Boolean, nullable=False)
    private_security: Mapped[bool] = mapped_column(Boolean, nullable=False)


class AppLotRow(Base):
    __tablename__ = "app_lots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    auction_id: Mapped[int] = mapped_column(ForeignKey("app_auctions.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, nullable=False)
    catalog_item_id: Mapped[int] = mapped_column(Integer, nullable=False)
    piece_number: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    story: Mapped[str | None] = mapped_column(Text, nullable=True)
    artist: Mapped[str | None] = mapped_column(String(250), nullable=True)
    base_price: Mapped[float] = mapped_column(Float, nullable=False)
    commission_rate: Mapped[float] = mapped_column(Float, nullable=False)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    image_urls_json: Mapped[str] = mapped_column(Text, nullable=False)
    current_bid: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_bidder_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bidding_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    bid_deadline_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sold: Mapped[bool] = mapped_column(Boolean, nullable=False)
    sold_to_company: Mapped[bool] = mapped_column(Boolean, nullable=False)


class AppBidRow(Base):
    __tablename__ = "app_bids"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    auction_id: Mapped[int] = mapped_column(ForeignKey("app_auctions.id"), nullable=False)
    lot_id: Mapped[int] = mapped_column(ForeignKey("app_lots.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    payment_method_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class AppNotificationRow(Base):
    __tablename__ = "app_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, nullable=False)


class AppWatchlistRow(Base):
    __tablename__ = "app_watchlist"

    user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), primary_key=True)
    auction_id: Mapped[int] = mapped_column(ForeignKey("app_auctions.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class AppConsignmentRow(Base):
    __tablename__ = "app_consignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    story: Mapped[str | None] = mapped_column(Text, nullable=True)
    photos_json: Mapped[str] = mapped_column(Text, nullable=False)
    declared_ownership: Mapped[bool] = mapped_column(Boolean, nullable=False)
    declared_legal_origin: Mapped[bool] = mapped_column(Boolean, nullable=False)
    declared_return_charge_agreement: Mapped[bool] = mapped_column(Boolean, nullable=False)
    lawful_origin_evidence_json: Mapped[str] = mapped_column(Text, nullable=False)
    item_count: Mapped[int] = mapped_column(Integer, nullable=False)
    collection_name: Mapped[str | None] = mapped_column(String(250), nullable=True)
    payout_account: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_base_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    commission_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    assigned_auction_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    storage_location: Mapped[str | None] = mapped_column(String(250), nullable=True)
    insurance_policy: Mapped[str | None] = mapped_column(String(100), nullable=True)
    inspection_address: Mapped[str | None] = mapped_column(String(350), nullable=True)
    return_shipping_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    return_shipping_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    origin_doubt_reported: Mapped[bool] = mapped_column(Boolean, nullable=False)
    origin_doubt_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    authority_reported_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AppMessageThreadRow(Base):
    __tablename__ = "app_message_threads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    owner_user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    consignment_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    purchase_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seller_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    subject: Mapped[str] = mapped_column(String(250), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class AppMessageRow(Base):
    __tablename__ = "app_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    thread_id: Mapped[int] = mapped_column(Integer, nullable=False)
    sender_type: Mapped[str] = mapped_column(String(30), nullable=False)
    sender_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class AppPurchaseRow(Base):
    __tablename__ = "app_purchases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    auction_id: Mapped[int] = mapped_column(ForeignKey("app_auctions.id"), nullable=False)
    lot_id: Mapped[int] = mapped_column(ForeignKey("app_lots.id"), nullable=False)
    buyer_user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    hammer_price: Mapped[float] = mapped_column(Float, nullable=False)
    commission_amount: Mapped[float] = mapped_column(Float, nullable=False)
    shipping_amount: Mapped[float] = mapped_column(Float, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    payment_method_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    paid: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class AppPenaltyRow(Base):
    __tablename__ = "app_penalties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)


class AppAttendanceRow(Base):
    __tablename__ = "app_attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False)
    auction_id: Mapped[int] = mapped_column(ForeignKey("app_auctions.id"), nullable=False)


class AppLegacyUserMetadataRow(Base):
    __tablename__ = "app_legacy_user_metadata"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    email: Mapped[str] = mapped_column(String(250), unique=True, nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    birth_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    registration_stage: Mapped[str] = mapped_column(String(40), nullable=False)
    roles_json: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(500), nullable=True)
    document_front_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_back_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)


class AppLegacyAuctionMetadataRow(Base):
    __tablename__ = "app_legacy_auction_metadata"

    auction_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False)


class AppLegacyLotMetadataRow(Base):
    __tablename__ = "app_legacy_lot_metadata"

    lot_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    catalog_item_id: Mapped[int] = mapped_column(Integer, nullable=False)
    piece_number: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    story: Mapped[str | None] = mapped_column(Text, nullable=True)
    artist: Mapped[str | None] = mapped_column(String(250), nullable=True)
    image_urls_json: Mapped[str] = mapped_column(Text, nullable=False)
    current_bidder_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bidding_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    bid_deadline_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sold_to_company: Mapped[bool] = mapped_column(Boolean, nullable=False)


class AppLegacyBidMetadataRow(Base):
    __tablename__ = "app_legacy_bid_metadata"

    bid_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    auction_id: Mapped[int] = mapped_column(Integer, nullable=False)
    lot_id: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    payment_method_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class AppLegacyPurchaseMetadataRow(Base):
    __tablename__ = "app_legacy_purchase_metadata"

    purchase_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    lot_id: Mapped[int] = mapped_column(Integer, nullable=False)
    shipping_amount: Mapped[float] = mapped_column(Float, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    payment_method_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    paid: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
