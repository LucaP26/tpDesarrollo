from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from contextlib import contextmanager
from datetime import date, datetime
from typing import Iterator

from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.db.models import (
    AppConsignmentRow,
    AppLegacyAuctionMetadataRow,
    AppLegacyBidMetadataRow,
    AppLegacyLotMetadataRow,
    AppLegacyPurchaseMetadataRow,
    AppLegacyUserMetadataRow,
    AppMessageRow,
    AppMessageThreadRow,
    AppNotificationRow,
    AppPasswordResetTokenRow,
    AppPaymentMethodRow,
    AppPenaltyRow,
    AppWatchlistRow,
)
from app.db.sqlserver import ensure_database_ready
from app.domain.constants import ADMIN_CONSIGNMENT_EMAILS, COMPANY_CLIENT_ID
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
    CorrespondenceMessageRecord,
    MessageThreadRecord,
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
        self.message_threads: dict[int, MessageThreadRecord] = {}
        self.messages: dict[int, CorrespondenceMessageRecord] = {}
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
        self.id_sequences["message_threads"] = max(self.message_threads.keys(), default=0)
        self.id_sequences["messages"] = max(self.messages.keys(), default=0)
        self.id_sequences["notifications"] = max(self.notifications.keys(), default=0)
        self.id_sequences["consignments"] = max(self.consignments.keys(), default=0)
        self.id_sequences["purchases"] = max(self.purchases.keys(), default=0)
        self.id_sequences["penalties"] = max(self.penalties.keys(), default=0)
        self.id_sequences["password_reset_tokens"] = max(self.password_reset_tokens.keys(), default=0)
        attendance_ids = [auction_id for auctions in self.auction_attendance_by_user.values() for auction_id in auctions]
        self.id_sequences["attendance"] = len(attendance_ids)

    def _ensure_admin_consignment_accounts(self) -> None:
        for user in self.users.values():
            if user.email.strip().lower() not in ADMIN_CONSIGNMENT_EMAILS:
                continue
            user.approved = True
            user.registration_stage = RegistrationStage.REGISTRO_COMPLETADO
            for role in (UserRole.CLIENTE, UserRole.DUENIO):
                if role not in user.roles:
                    user.roles.append(role)

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

        categories = {item.value for item in UserCategory}
        currencies = {item.value for item in Currency}

        def parse_user_roles(raw_roles: str | None) -> list[UserRole]:
            if not raw_roles:
                return []
            parsed: object
            try:
                parsed = json.loads(raw_roles)
            except json.JSONDecodeError:
                try:
                    parsed = json.loads(raw_roles.replace('""', '"'))
                except json.JSONDecodeError:
                    parsed = raw_roles.replace("[", "").replace("]", "").split(",")
            if isinstance(parsed, str):
                parsed = [parsed]
            roles: list[UserRole] = []
            if isinstance(parsed, list):
                for role in parsed:
                    role_value = str(role).strip().strip('"')
                    try:
                        roles.append(UserRole(role_value))
                    except ValueError:
                        continue
            return roles

        with self.session() as session:
            user_rows = session.execute(text("""
                SELECT
                    p.identificador,
                    p.documento,
                    p.nombre,
                    p.direccion,
                    p.estado,
                    c.numeroPais AS cliente_pais,
                    c.admitido,
                    c.categoria,
                    d.numeroPais AS duenio_pais,
                    m.email,
                    m.first_name,
                    m.last_name,
                    m.gender,
                    m.birth_date,
                    m.registration_stage,
                    m.roles_json,
                    m.password_hash,
                    m.document_front_image_url,
                    m.document_back_image_url,
                    m.avatar_image_url
                FROM dbo.personas p
                LEFT JOIN dbo.clientes c ON c.identificador = p.identificador
                LEFT JOIN dbo.duenios d ON d.identificador = p.identificador
                LEFT JOIN dbo.app_legacy_user_metadata m ON m.user_id = p.identificador
                WHERE m.user_id IS NOT NULL
                   OR c.identificador IS NOT NULL
                   OR d.identificador IS NOT NULL
            """)).mappings()
            for row in user_rows:
                full_name = row["nombre"] or ""
                parts = full_name.split(" ", 1)
                if row["roles_json"]:
                    roles = parse_user_roles(row["roles_json"])
                else:
                    roles = []
                if not roles:
                    if row["admitido"] is not None:
                        roles.append(UserRole.CLIENTE)
                    if row["duenio_pais"] is not None:
                        roles.append(UserRole.DUENIO)
                    if not roles:
                        roles = [UserRole.CLIENTE]
                category = row["categoria"] if row["categoria"] in categories else UserCategory.COMUN.value
                self.users[row["identificador"]] = AppUser(
                    id=row["identificador"],
                    email=row["email"] or f"legacy-{row['identificador']}@atelier.local",
                    document_number=row["documento"] or "",
                    first_name=row["first_name"] or (parts[0] if parts else full_name),
                    last_name=row["last_name"] or (parts[1] if len(parts) > 1 else ""),
                    gender=row["gender"] or "otro",
                    birth_date=date.fromisoformat(row["birth_date"]) if row["birth_date"] else None,
                    legal_address=row["direccion"] or "",
                    country_code=row["cliente_pais"] or row["duenio_pais"] or 32,
                    category=UserCategory(category),
                    approved=row["admitido"] == "si" or row["estado"] == "activo",
                    registration_stage=RegistrationStage(row["registration_stage"] or RegistrationStage.REGISTRO_COMPLETADO.value),
                    roles=roles,
                    password_hash=row["password_hash"],
                    document_front_image_url=row["document_front_image_url"],
                    document_back_image_url=row["document_back_image_url"],
                    avatar_image_url=row["avatar_image_url"],
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

            auction_rows = session.execute(text("""
                SELECT
                    s.identificador,
                    s.fecha,
                    s.hora,
                    s.estado,
                    s.ubicacion,
                    s.capacidadAsistentes,
                    s.tieneDeposito,
                    s.seguridadPropia,
                    s.categoria,
                    cat.descripcion AS titulo,
                    p.nombre AS subastador_nombre,
                    m.currency,
                    m.state
                FROM dbo.subastas s
                OUTER APPLY (
                    SELECT TOP 1 c.descripcion
                    FROM dbo.catalogos c
                    WHERE c.subasta = s.identificador
                    ORDER BY c.identificador
                ) cat
                LEFT JOIN dbo.subastadores sub ON sub.identificador = s.subastador
                LEFT JOIN dbo.personas p ON p.identificador = sub.identificador
                LEFT JOIN dbo.app_legacy_auction_metadata m ON m.auction_id = s.identificador
            """)).mappings()
            for row in auction_rows:
                category = row["categoria"] if row["categoria"] in categories else UserCategory.COMUN.value
                currency = row["currency"] if row["currency"] in currencies else Currency.ARS.value
                state = row["state"] or (AuctionState.CERRADA.value if row["estado"] == "carrada" else AuctionState.ABIERTA.value)
                self.auctions[row["identificador"]] = AuctionRecord(
                    id=row["identificador"],
                    title=row["titulo"] or f"Subasta {row['identificador']}",
                    scheduled_date=row["fecha"],
                    scheduled_time=row["hora"],
                    category=UserCategory(category),
                    currency=Currency(currency),
                    state=AuctionState(state),
                    auctioneer_name=row["subastador_nombre"] or "Sin subastador",
                    location=row["ubicacion"] or "",
                    capacity=row["capacidadAsistentes"] or 0,
                    has_storage=row["tieneDeposito"] == "si",
                    private_security=row["seguridadPropia"] == "si",
                )

            lot_rows = session.execute(text("""
                SELECT
                    COALESCE(m.lot_id, i.identificador) AS lot_id,
                    i.identificador AS catalog_item_id,
                    c.subasta AS auction_id,
                    p.identificador AS product_id,
                    COALESCE(m.piece_number, CONCAT('IT-', CONVERT(VARCHAR(20), i.identificador))) AS piece_number,
                    COALESCE(m.title, p.descripcionCatalogo, p.descripcionCompleta) AS title,
                    p.descripcionCompleta AS description,
                    m.story,
                    m.artist,
                    i.precioBase,
                    i.comision,
                    p.duenio,
                    m.image_urls_json,
                    best.importe AS current_bid,
                    COALESCE(m.current_bidder_id, best.cliente) AS current_bidder_id,
                    m.bidding_started_at,
                    m.bid_deadline_at,
                    i.subastado,
                    m.sold_to_company
                FROM dbo.itemsCatalogo i
                INNER JOIN dbo.catalogos c ON c.identificador = i.catalogo
                INNER JOIN dbo.productos p ON p.identificador = i.producto
                LEFT JOIN dbo.app_legacy_lot_metadata m ON m.catalog_item_id = i.identificador
                OUTER APPLY (
                    SELECT TOP 1 pu.importe, a.cliente
                    FROM dbo.pujos pu
                    INNER JOIN dbo.asistentes a ON a.identificador = pu.asistente
                    WHERE pu.item = i.identificador
                    ORDER BY pu.importe DESC, pu.identificador DESC
                ) best
            """)).mappings()
            for row in lot_rows:
                self.lots[row["lot_id"]] = AuctionLotRecord(
                    id=row["lot_id"],
                    auction_id=row["auction_id"],
                    product_id=row["product_id"],
                    catalog_item_id=row["catalog_item_id"],
                    piece_number=row["piece_number"],
                    title=row["title"] or "Lote sin titulo",
                    description=row["description"] or "",
                    story=row["story"],
                    artist=row["artist"],
                    base_price=float(row["precioBase"]),
                    commission_rate=float(row["comision"]),
                    owner_user_id=row["duenio"],
                    image_urls=json.loads(row["image_urls_json"]) if row["image_urls_json"] else [],
                    current_bid=float(row["current_bid"]) if row["current_bid"] is not None else None,
                    current_bidder_id=row["current_bidder_id"],
                    bidding_started_at=row["bidding_started_at"],
                    bid_deadline_at=row["bid_deadline_at"],
                    sold=row["subastado"] == "si",
                    sold_to_company=bool(row["sold_to_company"]),
                )

            bid_rows = session.execute(text("""
                SELECT
                    p.identificador,
                    c.subasta AS auction_id,
                    COALESCE(lm.lot_id, p.item) AS lot_id,
                    a.cliente AS user_id,
                    p.importe,
                    p.ganador,
                    bm.status,
                    bm.created_at,
                    bm.payment_method_id
                FROM dbo.pujos p
                INNER JOIN dbo.asistentes a ON a.identificador = p.asistente
                INNER JOIN dbo.itemsCatalogo i ON i.identificador = p.item
                INNER JOIN dbo.catalogos c ON c.identificador = i.catalogo
                LEFT JOIN dbo.app_legacy_lot_metadata lm ON lm.catalog_item_id = i.identificador
                LEFT JOIN dbo.app_legacy_bid_metadata bm ON bm.bid_id = p.identificador
            """)).mappings()
            for row in bid_rows:
                status_value = row["status"] or (BidStatus.GANADORA.value if row["ganador"] == "si" else BidStatus.CONFIRMADA.value)
                self.bids[row["identificador"]] = BidRecord(
                    id=row["identificador"],
                    auction_id=row["auction_id"],
                    lot_id=row["lot_id"],
                    user_id=row["user_id"],
                    amount=float(row["importe"]),
                    status=BidStatus(status_value),
                    created_at=row["created_at"] or datetime.utcnow(),
                    payment_method_id=row["payment_method_id"],
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
            for row in session.scalars(select(AppMessageThreadRow)).all():
                self.message_threads[row.id] = MessageThreadRecord(
                    id=row.id,
                    owner_user_id=row.owner_user_id,
                    consignment_id=row.consignment_id,
                    purchase_id=row.purchase_id,
                    seller_user_id=row.seller_user_id,
                    subject=row.subject,
                    status=row.status,
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                )
            for row in session.scalars(select(AppMessageRow)).all():
                self.messages[row.id] = CorrespondenceMessageRecord(
                    id=row.id,
                    thread_id=row.thread_id,
                    sender_type=row.sender_type,
                    sender_user_id=row.sender_user_id,
                    body=row.body,
                    created_at=row.created_at,
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
                    declared_return_charge_agreement=row.declared_return_charge_agreement,
                    lawful_origin_evidence=json.loads(row.lawful_origin_evidence_json),
                    item_count=row.item_count,
                    collection_name=row.collection_name,
                    payout_account=row.payout_account,
                    status=ConsignmentStatus(row.status),
                    created_at=row.created_at,
                    rejection_reason=row.rejection_reason,
                    proposed_base_price=float(row.proposed_base_price) if row.proposed_base_price is not None else None,
                    commission_rate=float(row.commission_rate) if row.commission_rate is not None else None,
                    assigned_auction_id=row.assigned_auction_id,
                    storage_location=row.storage_location,
                    insurance_policy=row.insurance_policy,
                    inspection_address=row.inspection_address,
                    return_shipping_cost=float(row.return_shipping_cost) if row.return_shipping_cost is not None else None,
                    return_shipping_note=row.return_shipping_note,
                    origin_doubt_reported=row.origin_doubt_reported,
                    origin_doubt_notes=row.origin_doubt_notes,
                    authority_reported_at=row.authority_reported_at,
                )

            purchase_rows = session.execute(text("""
                SELECT
                    r.identificador,
                    r.subasta,
                    COALESCE(pm.lot_id, lm.lot_id, i.identificador) AS lot_id,
                    r.cliente,
                    r.duenio,
                    r.importe,
                    r.comision,
                    pm.shipping_amount,
                    pm.total_amount,
                    COALESCE(pm.currency, am.currency, 'ARS') AS currency,
                    pm.payment_method_id,
                    pm.paid,
                    pm.created_at
                FROM dbo.registroDeSubasta r
                LEFT JOIN dbo.itemsCatalogo i ON i.producto = r.producto
                LEFT JOIN dbo.app_legacy_lot_metadata lm ON lm.catalog_item_id = i.identificador
                LEFT JOIN dbo.app_legacy_purchase_metadata pm ON pm.purchase_id = r.identificador
                LEFT JOIN dbo.app_legacy_auction_metadata am ON am.auction_id = r.subasta
            """)).mappings()
            for row in purchase_rows:
                currency = row["currency"] if row["currency"] in currencies else Currency.ARS.value
                total_amount = row["total_amount"]
                if total_amount is None:
                    total_amount = float(row["importe"]) + float(row["comision"])
                self.purchases[row["identificador"]] = PurchaseRecord(
                    id=row["identificador"],
                    auction_id=row["subasta"],
                    lot_id=row["lot_id"],
                    buyer_user_id=row["cliente"],
                    owner_user_id=row["duenio"],
                    hammer_price=float(row["importe"]),
                    commission_amount=float(row["comision"]),
                    shipping_amount=float(row["shipping_amount"] or 0),
                    total_amount=float(total_amount),
                    currency=Currency(currency),
                    payment_method_id=row["payment_method_id"],
                    paid=bool(row["paid"]),
                    created_at=row["created_at"] or datetime.utcnow(),
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
            attendance_rows = session.execute(text("SELECT cliente, subasta FROM dbo.asistentes")).mappings()
            for row in attendance_rows:
                self.auction_attendance_by_user[row["cliente"]].add(row["subasta"])

        self._ensure_admin_consignment_accounts()
        self._rebuild_relationships()
        self._reset_sequences_from_state()

    def persist_all(self) -> None:
        self._rebuild_relationships()

        def clip(value: object, length: int, fallback: str = "") -> str:
            text_value = fallback if value is None else str(value)
            if not text_value:
                text_value = fallback
            return text_value[:length]

        def auctioneer_identity(name: str) -> int:
            import hashlib

            digest = hashlib.sha1(name.encode("utf-8")).hexdigest()
            return -1000000 - (int(digest[:8], 16) % 100000000)

        system_employee_id = -900000
        has_company_purchase = any(purchase.buyer_user_id == COMPANY_CLIENT_ID for purchase in self.purchases.values()) or any(
            lot.sold_to_company for lot in self.lots.values()
        )
        client_user_ids = {
            user.id
            for user in self.users.values()
            if UserRole.CLIENTE in user.roles
        }
        client_user_ids.update(self.auction_attendance_by_user.keys())
        client_user_ids.update(bid.user_id for bid in self.bids.values())
        client_user_ids.update(purchase.buyer_user_id for purchase in self.purchases.values())
        if has_company_purchase:
            client_user_ids.add(COMPANY_CLIENT_ID)
        owner_user_ids = {
            user.id
            for user in self.users.values()
            if UserRole.DUENIO in user.roles
        }
        owner_user_ids.update(lot.owner_user_id for lot in self.lots.values())
        owner_user_ids.update(purchase.owner_user_id for purchase in self.purchases.values())
        owner_user_ids.update(consignment.owner_user_id for consignment in self.consignments.values())
        attendance_pairs = {
            (user_id, auction_id)
            for user_id, auction_ids in self.auction_attendance_by_user.items()
            for auction_id in auction_ids
        }
        attendance_pairs.update((bid.user_id, bid.auction_id) for bid in self.bids.values())
        attendance_pairs.update((purchase.buyer_user_id, purchase.auction_id) for purchase in self.purchases.values())

        with self.session() as session:
            for model in (
                AppLegacyPurchaseMetadataRow,
                AppLegacyBidMetadataRow,
                AppLegacyLotMetadataRow,
                AppLegacyAuctionMetadataRow,
                AppLegacyUserMetadataRow,
                AppPenaltyRow,
                AppPasswordResetTokenRow,
                AppMessageRow,
                AppMessageThreadRow,
                AppNotificationRow,
                AppWatchlistRow,
                AppConsignmentRow,
                AppPaymentMethodRow,
            ):
                session.execute(delete(model))

            session.add_all(
                [
                    AppLegacyUserMetadataRow(
                        user_id=user.id,
                        email=user.email,
                        first_name=user.first_name,
                        last_name=user.last_name,
                        gender=user.gender,
                        birth_date=user.birth_date.isoformat() if user.birth_date is not None else None,
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
                    AppLegacyAuctionMetadataRow(
                        auction_id=auction.id,
                        currency=auction.currency.value,
                        state=auction.state.value,
                    )
                    for auction in self.auctions.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppLegacyLotMetadataRow(
                        lot_id=lot.id,
                        catalog_item_id=lot.catalog_item_id,
                        piece_number=lot.piece_number,
                        title=lot.title,
                        story=lot.story,
                        artist=lot.artist,
                        image_urls_json=json.dumps(lot.image_urls),
                        current_bidder_id=lot.current_bidder_id,
                        bidding_started_at=lot.bidding_started_at,
                        bid_deadline_at=lot.bid_deadline_at,
                        sold_to_company=lot.sold_to_company,
                    )
                    for lot in self.lots.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppLegacyBidMetadataRow(
                        bid_id=bid.id,
                        auction_id=bid.auction_id,
                        lot_id=bid.lot_id,
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
                    AppMessageThreadRow(
                        id=item.id,
                        owner_user_id=item.owner_user_id,
                        consignment_id=item.consignment_id,
                        purchase_id=item.purchase_id,
                        seller_user_id=item.seller_user_id,
                        subject=item.subject,
                        status=item.status,
                        created_at=item.created_at,
                        updated_at=item.updated_at,
                    )
                    for item in self.message_threads.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppMessageRow(
                        id=item.id,
                        thread_id=item.thread_id,
                        sender_type=item.sender_type,
                        sender_user_id=item.sender_user_id,
                        body=item.body,
                        created_at=item.created_at,
                    )
                    for item in self.messages.values()
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
                        declared_return_charge_agreement=item.declared_return_charge_agreement,
                        lawful_origin_evidence_json=json.dumps(item.lawful_origin_evidence),
                        item_count=item.item_count,
                        collection_name=item.collection_name,
                        payout_account=item.payout_account,
                        status=item.status.value,
                        created_at=item.created_at,
                        rejection_reason=item.rejection_reason,
                        proposed_base_price=item.proposed_base_price,
                        commission_rate=item.commission_rate,
                        assigned_auction_id=item.assigned_auction_id,
                        storage_location=item.storage_location,
                        insurance_policy=item.insurance_policy,
                        inspection_address=item.inspection_address,
                        return_shipping_cost=item.return_shipping_cost,
                        return_shipping_note=item.return_shipping_note,
                        origin_doubt_reported=item.origin_doubt_reported,
                        origin_doubt_notes=item.origin_doubt_notes,
                        authority_reported_at=item.authority_reported_at,
                    )
                    for item in self.consignments.values()
                ]
            )
            session.flush()
            session.add_all(
                [
                    AppLegacyPurchaseMetadataRow(
                        purchase_id=item.id,
                        lot_id=item.lot_id,
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

            for table_name in (
                "app_attendance",
                "app_purchases",
                "app_bids",
                "app_lots",
                "app_auctions",
                "app_users",
            ):
                session.execute(text(f"DELETE FROM dbo.{table_name}"))

            session.execute(text("""
                IF EXISTS (SELECT 1 FROM dbo.empleados WHERE identificador = :id)
                    UPDATE dbo.empleados SET cargo = 'Sistema', sector = NULL WHERE identificador = :id
                ELSE
                    INSERT INTO dbo.empleados (identificador, cargo, sector) VALUES (:id, 'Sistema', NULL)
            """), {"id": system_employee_id})

            for country_code in sorted({user.country_code for user in self.users.values() if user.country_code is not None}):
                session.execute(text("""
                    IF NOT EXISTS (SELECT 1 FROM dbo.paises WHERE numero = :numero)
                        INSERT INTO dbo.paises (numero, nombre, nombreCorto, capital, nacionalidad, idiomas)
                        VALUES (:numero, :nombre, :nombreCorto, 'Sin datos', 'Sin datos', 'Sin datos')
                """), {
                    "numero": country_code,
                    "nombre": f"Pais {country_code}",
                    "nombreCorto": f"P{country_code}",
                })

            person_rows = []
            for user in self.users.values():
                person_rows.append({
                    "id": user.id,
                    "documento": clip(user.document_number, 20, f"DOC-{user.id}"),
                    "nombre": clip(f"{user.first_name} {user.last_name}".strip(), 150, user.email),
                    "direccion": clip(user.legal_address, 250, ""),
                    "estado": "activo" if user.approved else "incativo",
                })
            if has_company_purchase:
                person_rows.append({
                    "id": COMPANY_CLIENT_ID,
                    "documento": "ATELIER",
                    "nombre": "ATELIER",
                    "direccion": "Empresa compradora por base",
                    "estado": "activo",
                })
            auctioneer_rows = {}
            for auction in self.auctions.values():
                if auction.auctioneer_name:
                    auctioneer_rows[auctioneer_identity(auction.auctioneer_name)] = {
                        "id": auctioneer_identity(auction.auctioneer_name),
                        "documento": clip(f"SUB-{abs(auctioneer_identity(auction.auctioneer_name))}", 20, "SUB"),
                        "nombre": clip(auction.auctioneer_name, 150, "Subastador"),
                        "direccion": "",
                        "estado": "activo",
                        "matricula": clip(f"AUTO-{abs(auctioneer_identity(auction.auctioneer_name))}", 15, "AUTO"),
                        "region": clip(auction.location, 50, ""),
                    }
            person_rows.extend(auctioneer_rows.values())

            session.execute(text("SET IDENTITY_INSERT dbo.personas ON"))
            for row in person_rows:
                session.execute(text("""
                    IF EXISTS (SELECT 1 FROM dbo.personas WHERE identificador = :id)
                        UPDATE dbo.personas
                        SET documento = :documento,
                            nombre = :nombre,
                            direccion = :direccion,
                            estado = :estado
                        WHERE identificador = :id
                    ELSE
                        INSERT INTO dbo.personas (identificador, documento, nombre, direccion, estado, foto)
                        VALUES (:id, :documento, :nombre, :direccion, :estado, NULL)
                """), row)
            session.execute(text("SET IDENTITY_INSERT dbo.personas OFF"))

            for user_id in sorted(client_user_ids):
                if user_id == COMPANY_CLIENT_ID:
                    session.execute(text("""
                        IF EXISTS (SELECT 1 FROM dbo.clientes WHERE identificador = :id)
                            UPDATE dbo.clientes
                            SET numeroPais = NULL,
                                admitido = 'si',
                                categoria = 'platino',
                                verificador = :verificador
                            WHERE identificador = :id
                        ELSE
                            INSERT INTO dbo.clientes (identificador, numeroPais, admitido, categoria, verificador)
                            VALUES (:id, NULL, 'si', 'platino', :verificador)
                    """), {
                        "id": COMPANY_CLIENT_ID,
                        "verificador": system_employee_id,
                    })
                    continue
                user = self.users.get(user_id)
                if not user:
                    continue
                session.execute(text("""
                    IF EXISTS (SELECT 1 FROM dbo.clientes WHERE identificador = :id)
                        UPDATE dbo.clientes
                        SET numeroPais = :pais,
                            admitido = :admitido,
                            categoria = :categoria,
                            verificador = :verificador
                        WHERE identificador = :id
                    ELSE
                        INSERT INTO dbo.clientes (identificador, numeroPais, admitido, categoria, verificador)
                        VALUES (:id, :pais, :admitido, :categoria, :verificador)
                """), {
                    "id": user.id,
                    "pais": user.country_code,
                    "admitido": "si" if user.approved else "no",
                    "categoria": user.category.value,
                    "verificador": system_employee_id,
                })

            for user_id in sorted(owner_user_ids):
                user = self.users.get(user_id)
                if not user:
                    continue
                risk = {
                    UserCategory.PLATINO: 1,
                    UserCategory.ORO: 2,
                    UserCategory.PLATA: 3,
                    UserCategory.ESPECIAL: 4,
                    UserCategory.COMUN: 5,
                }[user.category]
                session.execute(text("""
                    IF EXISTS (SELECT 1 FROM dbo.duenios WHERE identificador = :id)
                        UPDATE dbo.duenios
                        SET numeroPais = :pais,
                            verificacionFinanciera = :verificacionFinanciera,
                            verificacionJudicial = :verificacionJudicial,
                            calificacionRiesgo = :riesgo,
                            verificador = :verificador
                        WHERE identificador = :id
                    ELSE
                        INSERT INTO dbo.duenios (
                            identificador,
                            numeroPais,
                            verificacionFinanciera,
                            verificacionJudicial,
                            calificacionRiesgo,
                            verificador
                        )
                        VALUES (:id, :pais, :verificacionFinanciera, :verificacionJudicial, :riesgo, :verificador)
                """), {
                    "id": user.id,
                    "pais": user.country_code,
                    "verificacionFinanciera": "si" if user.approved else "no",
                    "verificacionJudicial": "si" if user.approved else "no",
                    "riesgo": risk,
                    "verificador": system_employee_id,
                })

            for row in auctioneer_rows.values():
                session.execute(text("""
                    IF EXISTS (SELECT 1 FROM dbo.subastadores WHERE identificador = :id)
                        UPDATE dbo.subastadores
                        SET matricula = :matricula,
                            region = :region
                        WHERE identificador = :id
                    ELSE
                        INSERT INTO dbo.subastadores (identificador, matricula, region)
                        VALUES (:id, :matricula, :region)
                """), row)

            session.execute(text("ALTER TABLE dbo.subastas NOCHECK CONSTRAINT chkFecha"))
            session.execute(text("SET IDENTITY_INSERT dbo.subastas ON"))
            for auction in self.auctions.values():
                subastador_id = auctioneer_identity(auction.auctioneer_name) if auction.auctioneer_name else None
                session.execute(text("""
                    IF EXISTS (SELECT 1 FROM dbo.subastas WHERE identificador = :id)
                        UPDATE dbo.subastas
                        SET fecha = :fecha,
                            hora = :hora,
                            estado = :estado,
                            subastador = :subastador,
                            ubicacion = :ubicacion,
                            capacidadAsistentes = :capacidad,
                            tieneDeposito = :tieneDeposito,
                            seguridadPropia = :seguridadPropia,
                            categoria = :categoria
                        WHERE identificador = :id
                    ELSE
                        INSERT INTO dbo.subastas (
                            identificador,
                            fecha,
                            hora,
                            estado,
                            subastador,
                            ubicacion,
                            capacidadAsistentes,
                            tieneDeposito,
                            seguridadPropia,
                            categoria
                        )
                        VALUES (
                            :id,
                            :fecha,
                            :hora,
                            :estado,
                            :subastador,
                            :ubicacion,
                            :capacidad,
                            :tieneDeposito,
                            :seguridadPropia,
                            :categoria
                        )
                """), {
                    "id": auction.id,
                    "fecha": auction.scheduled_date,
                    "hora": auction.scheduled_time,
                    "estado": "carrada" if auction.state == AuctionState.CERRADA else "abierta",
                    "subastador": subastador_id,
                    "ubicacion": clip(auction.location, 350),
                    "capacidad": auction.capacity,
                    "tieneDeposito": "si" if auction.has_storage else "no",
                    "seguridadPropia": "si" if auction.private_security else "no",
                    "categoria": auction.category.value,
                })
            session.execute(text("SET IDENTITY_INSERT dbo.subastas OFF"))
            session.execute(text("ALTER TABLE dbo.subastas CHECK CONSTRAINT chkFecha"))

            session.execute(text("SET IDENTITY_INSERT dbo.catalogos ON"))
            for auction in self.auctions.values():
                session.execute(text("""
                    IF EXISTS (SELECT 1 FROM dbo.catalogos WHERE identificador = :id)
                        UPDATE dbo.catalogos
                        SET descripcion = :descripcion,
                            subasta = :subasta,
                            responsable = :responsable
                        WHERE identificador = :id
                    ELSE
                        INSERT INTO dbo.catalogos (identificador, descripcion, subasta, responsable)
                        VALUES (:id, :descripcion, :subasta, :responsable)
                """), {
                    "id": auction.id,
                    "descripcion": clip(auction.title, 250, f"Subasta {auction.id}"),
                    "subasta": auction.id,
                    "responsable": system_employee_id,
                })
            session.execute(text("SET IDENTITY_INSERT dbo.catalogos OFF"))

            for consignment in self.consignments.values():
                if consignment.insurance_policy:
                    session.execute(text("""
                        IF NOT EXISTS (SELECT 1 FROM dbo.seguros WHERE nroPoliza = :nroPoliza)
                            INSERT INTO dbo.seguros (nroPoliza, compania, polizaCombinada, importe)
                            VALUES (:nroPoliza, 'Sin datos', 'no', 0.01)
                    """), {"nroPoliza": clip(consignment.insurance_policy, 30)})

            session.execute(text("SET IDENTITY_INSERT dbo.productos ON"))
            for lot in self.lots.values():
                session.execute(text("""
                    IF EXISTS (SELECT 1 FROM dbo.productos WHERE identificador = :id)
                        UPDATE dbo.productos
                        SET fecha = :fecha,
                            disponible = :disponible,
                            descripcionCatalogo = :descripcionCatalogo,
                            descripcionCompleta = :descripcionCompleta,
                            revisor = :revisor,
                            duenio = :duenio,
                            seguro = NULL
                        WHERE identificador = :id
                    ELSE
                        INSERT INTO dbo.productos (
                            identificador,
                            fecha,
                            disponible,
                            descripcionCatalogo,
                            descripcionCompleta,
                            revisor,
                            duenio,
                            seguro
                        )
                        VALUES (
                            :id,
                            :fecha,
                            :disponible,
                            :descripcionCatalogo,
                            :descripcionCompleta,
                            :revisor,
                            :duenio,
                            NULL
                        )
                """), {
                    "id": lot.product_id,
                    "fecha": self.auctions[lot.auction_id].scheduled_date if lot.auction_id in self.auctions else None,
                    "disponible": "no" if lot.sold else "si",
                    "descripcionCatalogo": clip(f"{lot.title} - {lot.description}", 500, lot.title),
                    "descripcionCompleta": clip(lot.description, 300, lot.title or "Sin descripcion"),
                    "revisor": system_employee_id,
                    "duenio": lot.owner_user_id,
                })
            for consignment in self.consignments.values():
                product_id = -300000000 - consignment.id
                consignment_product_date = consignment.created_at.date()
                if (
                    consignment.status == ConsignmentStatus.ACEPTADA
                    and consignment.assigned_auction_id in self.auctions
                ):
                    consignment_product_date = self.auctions[consignment.assigned_auction_id].scheduled_date
                session.execute(text("""
                    IF EXISTS (SELECT 1 FROM dbo.productos WHERE identificador = :id)
                        UPDATE dbo.productos
                        SET fecha = :fecha,
                            disponible = :disponible,
                            descripcionCatalogo = :descripcionCatalogo,
                            descripcionCompleta = :descripcionCompleta,
                            revisor = :revisor,
                            duenio = :duenio,
                            seguro = :seguro
                        WHERE identificador = :id
                    ELSE
                        INSERT INTO dbo.productos (
                            identificador,
                            fecha,
                            disponible,
                            descripcionCatalogo,
                            descripcionCompleta,
                            revisor,
                            duenio,
                            seguro
                        )
                        VALUES (
                            :id,
                            :fecha,
                            :disponible,
                            :descripcionCatalogo,
                            :descripcionCompleta,
                            :revisor,
                            :duenio,
                            :seguro
                        )
                """), {
                    "id": product_id,
                    "fecha": consignment_product_date,
                    "disponible": "si" if consignment.status == ConsignmentStatus.ACEPTADA else "no",
                    "descripcionCatalogo": clip(f"{consignment.title} - {consignment.description}", 500, consignment.title),
                    "descripcionCompleta": clip(consignment.description, 300, consignment.title or "Sin descripcion"),
                    "revisor": system_employee_id,
                    "duenio": consignment.owner_user_id,
                    "seguro": clip(consignment.insurance_policy, 30) if consignment.insurance_policy else None,
                })
            session.execute(text("SET IDENTITY_INSERT dbo.productos OFF"))

            session.execute(text("SET IDENTITY_INSERT dbo.itemsCatalogo ON"))
            for lot in self.lots.values():
                session.execute(text("""
                    IF EXISTS (SELECT 1 FROM dbo.itemsCatalogo WHERE identificador = :id)
                        UPDATE dbo.itemsCatalogo
                        SET catalogo = :catalogo,
                            producto = :producto,
                            precioBase = :precioBase,
                            comision = :comision,
                            subastado = :subastado
                        WHERE identificador = :id
                    ELSE
                        INSERT INTO dbo.itemsCatalogo (identificador, catalogo, producto, precioBase, comision, subastado)
                        VALUES (:id, :catalogo, :producto, :precioBase, :comision, :subastado)
                """), {
                    "id": lot.catalog_item_id,
                    "catalogo": lot.auction_id,
                    "producto": lot.product_id,
                    "precioBase": max(lot.base_price, 0.02),
                    "comision": max(lot.commission_rate, 0.02),
                    "subastado": "si" if lot.sold else "no",
                })
            session.execute(text("SET IDENTITY_INSERT dbo.itemsCatalogo OFF"))

            session.execute(text("DELETE FROM dbo.pujos"))
            session.execute(text("DELETE FROM dbo.asistentes"))
            for user_id, auction_id in sorted(attendance_pairs):
                if user_id not in self.users or auction_id not in self.auctions:
                    continue
                session.execute(text("""
                    INSERT INTO dbo.asistentes (numeroPostor, cliente, subasta)
                    VALUES (:numeroPostor, :cliente, :subasta)
                """), {
                    "numeroPostor": (abs((user_id * 1000003) + auction_id) % 2147483646) + 1,
                    "cliente": user_id,
                    "subasta": auction_id,
                })

            session.execute(text("SET IDENTITY_INSERT dbo.pujos ON"))
            for bid in self.bids.values():
                lot = self.lots.get(bid.lot_id)
                if not lot:
                    continue
                session.execute(text("""
                    INSERT INTO dbo.pujos (identificador, asistente, item, importe, ganador)
                    SELECT :id, a.identificador, :item, :importe, :ganador
                    FROM dbo.asistentes a
                    WHERE a.cliente = :cliente
                      AND a.subasta = :subasta
                """), {
                    "id": bid.id,
                    "item": lot.catalog_item_id,
                    "importe": max(bid.amount, 0.02),
                    "ganador": "si" if bid.status == BidStatus.GANADORA else "no",
                    "cliente": bid.user_id,
                    "subasta": bid.auction_id,
                })
            session.execute(text("SET IDENTITY_INSERT dbo.pujos OFF"))

            session.execute(text("SET IDENTITY_INSERT dbo.registroDeSubasta ON"))
            for purchase in self.purchases.values():
                lot = self.lots.get(purchase.lot_id)
                if not lot:
                    continue
                session.execute(text("""
                    IF EXISTS (SELECT 1 FROM dbo.registroDeSubasta WHERE identificador = :id)
                        UPDATE dbo.registroDeSubasta
                        SET subasta = :subasta,
                            duenio = :duenio,
                            producto = :producto,
                            cliente = :cliente,
                            importe = :importe,
                            comision = :comision
                        WHERE identificador = :id
                    ELSE
                        INSERT INTO dbo.registroDeSubasta (
                            identificador,
                            subasta,
                            duenio,
                            producto,
                            cliente,
                            importe,
                            comision
                        )
                        VALUES (
                            :id,
                            :subasta,
                            :duenio,
                            :producto,
                            :cliente,
                            :importe,
                            :comision
                        )
                """), {
                    "id": purchase.id,
                    "subasta": purchase.auction_id,
                    "duenio": purchase.owner_user_id,
                    "producto": lot.product_id,
                    "cliente": purchase.buyer_user_id,
                    "importe": max(purchase.hammer_price, 0.02),
                    "comision": max(purchase.commission_amount, 0.02),
                })
            session.execute(text("SET IDENTITY_INSERT dbo.registroDeSubasta OFF"))

            session.commit()
        self._reset_sequences_from_state()
