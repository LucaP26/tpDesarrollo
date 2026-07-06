from __future__ import annotations

from app.domain.schemas import AppUser, HistoryEntryResponse, MetricsResponse, WonItemResponse
from app.services.notifications import NotificationService
from app.services.shipping_compliance import (
    apply_overdue_shipping_coordination_penalties,
    has_started_shipping_coordination,
    shipping_deadline_at,
    shipping_penalty_amount,
)
from app.services.store import StoreBase


class MetricsService:
    SELLER_EMAIL = "m@gmail.com"

    def __init__(self, store: StoreBase, notifications: NotificationService | None = None) -> None:
        self.store = store
        self.notifications = notifications

    def _seller_user(self) -> AppUser | None:
        return next((user for user in self.store.users.values() if user.email == self.SELLER_EMAIL), None)

    def get_personal_metrics(self, user: AppUser) -> MetricsResponse:
        apply_overdue_shipping_coordination_penalties(self.store, self.notifications, user)
        joined_auctions = self.store.auction_attendance_by_user.get(user.id, set())
        winning_purchases = [
            purchase for purchase in self.store.purchases.values() if purchase.buyer_user_id == user.id
        ]
        active_bids = [
            lot for lot in self.store.lots.values() if lot.current_bidder_id == user.id and not lot.sold
        ]
        total_amount_bid = sum(bid.amount for bid in self.store.bids.values() if bid.user_id == user.id)
        total_amount_paid = sum(purchase.total_amount for purchase in winning_purchases)
        categories_joined: dict[str, int] = {}
        for auction_id in joined_auctions:
            auction = self.store.auctions.get(auction_id)
            if auction:
                key = auction.category.value
                categories_joined[key] = categories_joined.get(key, 0) + 1
        won_items: list[WonItemResponse] = []
        seller = self._seller_user()
        seller_name = f"{seller.first_name} {seller.last_name}".strip() if seller else None
        for purchase in sorted(winning_purchases, key=lambda item: item.created_at, reverse=True):
            lot = self.store.lots.get(purchase.lot_id)
            if not lot:
                continue
            won_items.append(
                WonItemResponse(
                    purchase_id=purchase.id,
                    auction_id=purchase.auction_id,
                    lot_id=purchase.lot_id,
                    piece_number=lot.piece_number,
                    title=lot.title,
                    description=lot.description,
                    image_url=lot.image_urls[0] if lot.image_urls else None,
                    hammer_price=round(purchase.hammer_price, 2),
                    commission_amount=round(purchase.commission_amount, 2),
                    shipping_amount=round(purchase.shipping_amount, 2),
                    tax_amount=round(purchase.commission_amount, 2),
                    shipping_deadline_at=shipping_deadline_at(purchase),
                    shipping_penalty_amount=shipping_penalty_amount(purchase),
                    shipping_coordination_started=has_started_shipping_coordination(self.store, purchase),
                    total_amount=round(purchase.total_amount, 2),
                    currency=purchase.currency,
                    seller_user_id=seller.id if seller else None,
                    seller_email=seller.email if seller else self.SELLER_EMAIL,
                    seller_name=seller_name or self.SELLER_EMAIL,
                    won_at=purchase.created_at,
                )
            )
        return MetricsResponse(
            auctions_joined=len(joined_auctions),
            auctions_won=len(winning_purchases),
            active_bids=len(active_bids),
            total_amount_bid=round(total_amount_bid, 2),
            total_amount_paid=round(total_amount_paid, 2),
            categories_joined=categories_joined,
            won_items=won_items,
        )

    def get_history(self, user: AppUser) -> list[HistoryEntryResponse]:
        items: list[HistoryEntryResponse] = []
        for bid in self.store.bids.values():
            if bid.user_id == user.id:
                items.append(
                    HistoryEntryResponse(
                        type="puja",
                        description=f"Puja sobre lote {bid.lot_id} en subasta {bid.auction_id}",
                        amount=bid.amount,
                        occurred_at=bid.created_at,
                    )
                )
        for purchase in self.store.purchases.values():
            if purchase.buyer_user_id == user.id:
                items.append(
                    HistoryEntryResponse(
                        type="compra",
                        description=f"Compra ganada del lote {purchase.lot_id}",
                        amount=purchase.total_amount,
                        occurred_at=purchase.created_at,
                    )
                )
        items.sort(key=lambda item: item.occurred_at, reverse=True)
        return items
