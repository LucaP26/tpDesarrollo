from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal
from pydantic import BaseModel, Field

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


class BaseApiModel(BaseModel):
    pass


GenderValue = Literal["femenino", "masculino", "otro"]


class NotificationRecord(BaseApiModel):
    id: int
    user_id: int
    title: str
    message: str
    kind: NotificationKind = NotificationKind.INFO
    created_at: datetime
    read: bool = False


class MessageThreadRecord(BaseApiModel):
    id: int
    owner_user_id: int
    consignment_id: int | None = None
    subject: str
    status: str = "abierto"
    created_at: datetime
    updated_at: datetime


class CorrespondenceMessageRecord(BaseApiModel):
    id: int
    thread_id: int
    sender_type: str
    sender_user_id: int | None = None
    body: str
    created_at: datetime


class WatchlistRecord(BaseApiModel):
    user_id: int
    auction_id: int
    created_at: datetime


class PenaltyRecord(BaseApiModel):
    id: int
    user_id: int
    amount: float
    status: PenaltyStatus
    due_at: datetime
    reason: str


class PasswordResetTokenRecord(BaseApiModel):
    id: int
    user_id: int
    token_hash: str
    created_at: datetime
    expires_at: datetime
    used_at: datetime | None = None


class PaymentMethodRecord(BaseApiModel):
    id: int
    user_id: int
    type: PaymentType
    display_name: str
    currency: Currency
    issuer_country: str
    available_amount: float
    status: PaymentStatus = PaymentStatus.PENDIENTE
    last_four: str | None = None
    holder_first_name: str | None = None
    holder_last_name: str | None = None
    issuing_bank: str | None = None
    expiration_date: str | None = None
    verified_at: datetime | None = None


class BidRecord(BaseApiModel):
    id: int
    auction_id: int
    lot_id: int
    user_id: int
    amount: float
    status: BidStatus
    created_at: datetime
    payment_method_id: int | None = None


class AuctionLotRecord(BaseApiModel):
    id: int
    auction_id: int
    product_id: int
    catalog_item_id: int
    piece_number: str
    title: str
    description: str
    story: str | None = None
    artist: str | None = None
    base_price: float
    commission_rate: float
    owner_user_id: int
    image_urls: list[str] = Field(default_factory=list)
    current_bid: float | None = None
    current_bidder_id: int | None = None
    bidding_started_at: datetime | None = None
    bid_deadline_at: datetime | None = None
    bid_ids: list[int] = Field(default_factory=list)
    sold: bool = False
    sold_to_company: bool = False


class PurchaseRecord(BaseApiModel):
    id: int
    auction_id: int
    lot_id: int
    buyer_user_id: int
    owner_user_id: int
    hammer_price: float
    commission_amount: float
    shipping_amount: float
    total_amount: float
    currency: Currency
    payment_method_id: int | None = None
    paid: bool = False
    created_at: datetime


class ConsignmentRecord(BaseApiModel):
    id: int
    owner_user_id: int
    title: str
    description: str
    story: str | None = None
    photos: list[str] = Field(default_factory=list)
    declared_ownership: bool
    declared_legal_origin: bool
    declared_return_charge_agreement: bool = False
    lawful_origin_evidence: list[str] = Field(default_factory=list)
    item_count: int = 1
    collection_name: str | None = None
    payout_account: str | None = None
    status: ConsignmentStatus
    created_at: datetime
    rejection_reason: str | None = None
    proposed_base_price: float | None = None
    commission_rate: float | None = None
    assigned_auction_id: int | None = None
    storage_location: str | None = None
    insurance_policy: str | None = None
    inspection_address: str | None = None
    return_shipping_cost: float | None = None
    return_shipping_note: str | None = None
    origin_doubt_reported: bool = False
    origin_doubt_notes: str | None = None
    authority_reported_at: datetime | None = None


class AppUser(BaseApiModel):
    id: int
    email: str
    document_number: str
    first_name: str
    last_name: str
    gender: GenderValue = "otro"
    birth_date: date | None = None
    legal_address: str
    country_code: int
    category: UserCategory
    approved: bool
    registration_stage: RegistrationStage
    roles: list[UserRole]
    password_hash: str | None = None
    document_front_image_url: str | None = None
    document_back_image_url: str | None = None
    avatar_image_url: str | None = None
    payment_method_ids: list[int] = Field(default_factory=list)
    won_purchase_ids: list[int] = Field(default_factory=list)
    consignment_ids: list[int] = Field(default_factory=list)


class AuctionRecord(BaseApiModel):
    id: int
    title: str
    scheduled_date: date
    scheduled_time: time
    category: UserCategory
    currency: Currency
    state: AuctionState
    auctioneer_name: str
    location: str
    capacity: int
    has_storage: bool
    private_security: bool
    lot_ids: list[int] = Field(default_factory=list)


class PreRegisterRequest(BaseApiModel):
    email: str
    document_number: str
    first_name: str
    last_name: str
    legal_address: str
    country_code: int
    roles: list[UserRole] = Field(default_factory=lambda: [UserRole.CLIENTE, UserRole.DUENIO])
    document_front_image_url: str
    document_back_image_url: str


class OnboardingRegistrationRequest(BaseApiModel):
    email: str
    document_number: str
    first_name: str
    last_name: str
    gender: GenderValue
    birth_date: date
    legal_address: str
    country_code: int
    roles: list[UserRole] = Field(default_factory=lambda: [UserRole.CLIENTE, UserRole.DUENIO])
    document_front_image_url: str
    document_back_image_url: str
    payment_method: "PaymentMethodCreate"


class RegistrationProgressResponse(BaseApiModel):
    user_id: int
    registration_stage: RegistrationStage
    approved: bool
    message: str


class MessageResponse(BaseApiModel):
    message: str


class CompleteRegistrationRequest(BaseApiModel):
    user_id: int
    password: str


class PasswordSetupRequest(BaseApiModel):
    email: str
    token: str
    password: str


class LoginRequest(BaseApiModel):
    email: str
    password: str


class PasswordResetRequest(BaseApiModel):
    email: str


class PasswordResetConfirmRequest(BaseApiModel):
    email: str
    code: str
    new_password: str


class PasswordChangeRequest(BaseApiModel):
    current_password: str
    new_password: str


class ProfileAvatarUpdateRequest(BaseApiModel):
    avatar_image_url: str


class ProfileUpdateRequest(BaseApiModel):
    first_name: str
    last_name: str
    email: str
    legal_address: str


class UserProfileResponse(BaseApiModel):
    id: int
    email: str
    first_name: str
    last_name: str
    full_name: str
    document_number: str
    legal_address: str
    country_code: int
    gender: GenderValue = "otro"
    category: UserCategory
    approved: bool
    registration_stage: RegistrationStage
    roles: list[UserRole]
    avatar_image_url: str | None = None


class AuthTokenResponse(BaseApiModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse


class PaymentMethodCreate(BaseApiModel):
    type: PaymentType
    display_name: str
    currency: Currency
    issuer_country: str
    available_amount: float
    last_four: str | None = None
    holder_first_name: str | None = None
    holder_last_name: str | None = None
    issuing_bank: str | None = None
    expiration_date: str | None = None


class PaymentMethodUpdate(PaymentMethodCreate):
    pass


class PaymentMethodResponse(BaseApiModel):
    id: int
    type: PaymentType
    display_name: str
    currency: Currency
    issuer_country: str
    available_amount: float
    status: PaymentStatus
    last_four: str | None = None
    holder_first_name: str | None = None
    holder_last_name: str | None = None
    issuing_bank: str | None = None
    expiration_date: str | None = None


class AuctionSummaryResponse(BaseApiModel):
    id: int
    title: str
    scheduled_at: datetime
    category: UserCategory
    currency: Currency
    state: AuctionState
    auctioneer_name: str
    location: str
    can_view_catalog: bool = True
    view_block_reason: str | None = None
    can_bid: bool
    block_reason: str | None = None
    current_lot_title: str | None = None
    best_offer: float | None = None
    preview_lot_title: str | None = None
    preview_image_url: str | None = None
    preview_base_price: float | None = None
    price_available: bool = True
    total_lots: int = 0
    remaining_lots: int = 0
    searchable_terms: list[str] = Field(default_factory=list)
    in_watchlist: bool = False


class AuctionLotView(BaseApiModel):
    id: int
    piece_number: str
    title: str
    description: str
    story: str | None = None
    artist: str | None = None
    image_urls: list[str]
    base_price: float
    price_available: bool = True
    commission_rate: float
    current_bid: float | None = None
    current_bidder_id: int | None = None
    bidding_started_at: datetime | None = None
    bid_deadline_at: datetime | None = None
    bid_seconds_remaining: int | None = None
    min_bid: float
    max_bid: float | None = None
    can_bid: bool
    block_reason: str | None = None
    sold: bool
    sold_to_company: bool


class AuctionDetailResponse(BaseApiModel):
    id: int
    title: str
    scheduled_at: datetime
    category: UserCategory
    currency: Currency
    state: AuctionState
    auctioneer_name: str
    location: str
    can_view_catalog: bool = True
    view_block_reason: str | None = None
    can_bid: bool
    block_reason: str | None = None
    current_lot_title: str | None = None
    best_offer: float | None = None
    preview_lot_title: str | None = None
    preview_image_url: str | None = None
    preview_base_price: float | None = None
    price_available: bool = True
    total_lots: int = 0
    remaining_lots: int = 0
    current_lot: AuctionLotView | None = None
    upcoming_lots: list[AuctionLotView] = Field(default_factory=list)
    completed_lots: list[AuctionLotView] = Field(default_factory=list)
    lots: list[AuctionLotView]


class JoinAuctionResponse(BaseApiModel):
    auction_id: int
    connected: bool
    can_bid: bool
    block_reason: str | None = None
    websocket_path: str
    user_category: UserCategory


class ActiveAuctionResponse(BaseApiModel):
    auction_id: int
    title: str
    category: UserCategory
    currency: Currency
    scheduled_at: datetime
    location: str
    current_lot_id: int | None = None
    current_lot_title: str | None = None
    current_lot_image_url: str | None = None
    current_price: float | None = None
    my_latest_bid: float | None = None
    my_is_leading: bool = False


class LeaveAuctionResponse(BaseApiModel):
    message: str
    auction_id: int
    removed_bid_amount: float | None = None
    new_current_bid: float | None = None
    new_current_bidder_id: int | None = None


class BidCreate(BaseApiModel):
    amount: float
    payment_method_id: int | None = None


class BidResponse(BaseApiModel):
    bid_id: int
    auction_id: int
    lot_id: int
    amount: float
    status: BidStatus
    current_best_bid: float
    current_best_bidder_id: int
    min_bid: float
    max_bid: float | None = None


class NotificationResponse(BaseApiModel):
    id: int
    title: str
    message: str
    kind: NotificationKind
    created_at: datetime
    read: bool


class CorrespondenceMessageCreate(BaseApiModel):
    body: str


class CorrespondenceMessageResponse(BaseApiModel):
    id: int
    thread_id: int
    sender_type: str
    sender_user_id: int | None = None
    body: str
    created_at: datetime


class MessageThreadResponse(BaseApiModel):
    id: int
    consignment_id: int | None = None
    subject: str
    status: str
    created_at: datetime
    updated_at: datetime
    last_message: CorrespondenceMessageResponse | None = None
    messages: list[CorrespondenceMessageResponse] = Field(default_factory=list)


class MetricsResponse(BaseApiModel):
    auctions_joined: int
    auctions_won: int
    active_bids: int
    total_amount_bid: float
    total_amount_paid: float
    categories_joined: dict[str, int]


class HistoryEntryResponse(BaseApiModel):
    type: str
    description: str
    amount: float | None = None
    occurred_at: datetime


class ConsignmentCreate(BaseApiModel):
    title: str
    description: str
    story: str | None = None
    photos: list[str]
    declared_ownership: bool
    declared_legal_origin: bool
    declared_return_charge_agreement: bool
    lawful_origin_evidence: list[str] = Field(default_factory=list)
    item_count: int = 1
    collection_name: str | None = None
    payout_account: str | None = None


class ConsignmentResponse(BaseApiModel):
    id: int
    title: str
    description: str
    story: str | None = None
    status: ConsignmentStatus
    declared_ownership: bool = False
    declared_legal_origin: bool = False
    declared_return_charge_agreement: bool = False
    lawful_origin_evidence: list[str] = Field(default_factory=list)
    created_at: datetime | None = None
    rejection_reason: str | None = None
    proposed_base_price: float | None = None
    commission_rate: float | None = None
    assigned_auction_id: int | None = None
    storage_location: str | None = None
    insurance_policy: str | None = None
    inspection_address: str | None = None
    return_shipping_cost: float | None = None
    return_shipping_note: str | None = None
    origin_doubt_reported: bool = False
    origin_doubt_notes: str | None = None
    authority_reported_at: datetime | None = None
    item_count: int = 1
    collection_name: str | None = None
    payout_account: str | None = None
    photos: list[str]


class AdminUserApprovalRequest(BaseApiModel):
    category: UserCategory = UserCategory.COMUN


class AdminConsignmentReviewRequest(BaseApiModel):
    approve: bool | None = None
    request_inspection: bool = False
    rejection_reason: str | None = None
    proposed_base_price: float | None = None
    commission_rate: float | None = None
    assigned_auction_id: int | None = None
    storage_location: str | None = None
    insurance_policy: str | None = None
    inspection_address: str | None = None
    return_shipping_cost: float | None = None
    return_shipping_note: str | None = None
    origin_doubt_reported: bool = False
    origin_doubt_notes: str | None = None


class ConsignmentProposalDecisionRequest(BaseApiModel):
    accept: bool
    payout_account: str | None = None


class AdminAuctionLotCreate(BaseApiModel):
    product_id: int
    catalog_item_id: int
    piece_number: str
    title: str
    description: str
    story: str | None = None
    artist: str | None = None
    base_price: float
    commission_rate: float
    owner_user_id: int
    image_urls: list[str] = Field(default_factory=list)


class AdminAuctionCreateRequest(BaseApiModel):
    title: str
    scheduled_date: date
    scheduled_time: time
    category: UserCategory
    currency: Currency
    auctioneer_name: str
    location: str
    capacity: int = 100
    has_storage: bool = True
    private_security: bool = True
    lots: list[AdminAuctionLotCreate]


class AdminDashboardResponse(BaseApiModel):
    pending_users: list[UserProfileResponse]
    pending_payments: list[PaymentMethodResponse]
    pending_consignments: list[ConsignmentResponse]
    message_threads: list[MessageThreadResponse] = Field(default_factory=list)
    auctions: list[AuctionSummaryResponse]
