from __future__ import annotations

from app.domain.schemas import AppUser, HistoryEntryResponse, MetricsResponse
from app.services.store import StoreBase


class MetricsService:
    def __init__(self, store: StoreBase) -> None:
        self.store = store

    def get_personal_metrics(self, user: AppUser) -> MetricsResponse:
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
        return MetricsResponse(
            auctions_joined=len(joined_auctions),
            auctions_won=len(winning_purchases),
            active_bids=len(active_bids),
            total_amount_bid=round(total_amount_bid, 2),
            total_amount_paid=round(total_amount_paid, 2),
            categories_joined=categories_joined,
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
