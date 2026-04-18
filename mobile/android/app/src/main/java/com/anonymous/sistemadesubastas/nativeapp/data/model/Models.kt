package com.anonymous.sistemadesubastas.nativeapp.data.model

import org.json.JSONArray
import org.json.JSONObject

data class UserProfile(
    val email: String,
    val fullName: String,
    val legalAddress: String,
    val category: String,
    val avatarImageUrl: String?
) {
    companion object {
        fun fromJson(json: JSONObject): UserProfile = UserProfile(
            email = json.optString("email"),
            fullName = json.optString("full_name"),
            legalAddress = json.optString("legal_address"),
            category = json.optString("category", "comun"),
            avatarImageUrl = json.optString("avatar_image_url").takeIf { it.isNotBlank() }
        )
    }
}

data class AuthResponse(
    val accessToken: String,
    val user: UserProfile
) {
    companion object {
        fun fromJson(json: JSONObject): AuthResponse = AuthResponse(
            accessToken = json.optString("access_token"),
            user = UserProfile.fromJson(json.getJSONObject("user"))
        )
    }
}

data class AuctionSummary(
    val id: Int,
    val title: String,
    val scheduledAt: String,
    val category: String,
    val currency: String,
    val location: String,
    val auctioneerName: String,
    val canViewCatalog: Boolean,
    val canBid: Boolean,
    val viewBlockReason: String?,
    val bestOffer: Double?,
    val previewLotTitle: String?,
    val previewImageUrl: String?,
    val previewBasePrice: Double?,
    val totalLots: Int
) {
    companion object {
        fun fromJson(json: JSONObject): AuctionSummary = AuctionSummary(
            id = json.optInt("id"),
            title = json.optString("title"),
            scheduledAt = json.optString("scheduled_at"),
            category = json.optString("category"),
            currency = json.optString("currency"),
            location = json.optString("location"),
            auctioneerName = json.optString("auctioneer_name"),
            canViewCatalog = json.optBoolean("can_view_catalog"),
            canBid = json.optBoolean("can_bid"),
            viewBlockReason = json.optString("view_block_reason").takeIf { it.isNotBlank() },
            bestOffer = json.optDouble("best_offer").takeIf { !it.isNaN() && it != 0.0 || json.has("best_offer") },
            previewLotTitle = json.optString("preview_lot_title").takeIf { it.isNotBlank() },
            previewImageUrl = json.optString("preview_image_url").takeIf { it.isNotBlank() },
            previewBasePrice = json.optDouble("preview_base_price").takeIf { !it.isNaN() && (it != 0.0 || json.has("preview_base_price")) },
            totalLots = json.optInt("total_lots")
        )
    }
}

data class AuctionLot(
    val id: Int,
    val pieceNumber: String,
    val title: String,
    val description: String,
    val imageUrls: List<String>,
    val basePrice: Double,
    val currentBid: Double?,
    val minBid: Double,
    val maxBid: Double?,
    val canBid: Boolean,
    val blockReason: String?,
    val sold: Boolean,
    val soldToCompany: Boolean
) {
    companion object {
        fun fromJson(json: JSONObject): AuctionLot = AuctionLot(
            id = json.optInt("id"),
            pieceNumber = json.optString("piece_number"),
            title = json.optString("title"),
            description = json.optString("description"),
            imageUrls = json.optJSONArray("image_urls").toStringList(),
            basePrice = json.optDouble("base_price"),
            currentBid = json.optDouble("current_bid").takeIf { !it.isNaN() && (it != 0.0 || json.has("current_bid")) },
            minBid = json.optDouble("min_bid"),
            maxBid = json.optDouble("max_bid").takeIf { !it.isNaN() && (it != 0.0 || json.has("max_bid")) },
            canBid = json.optBoolean("can_bid"),
            blockReason = json.optString("block_reason").takeIf { it.isNotBlank() },
            sold = json.optBoolean("sold"),
            soldToCompany = json.optBoolean("sold_to_company")
        )
    }
}

data class AuctionDetail(
    val id: Int,
    val title: String,
    val scheduledAt: String,
    val category: String,
    val currency: String,
    val location: String,
    val auctioneerName: String,
    val canBid: Boolean,
    val blockReason: String?,
    val currentLot: AuctionLot?,
    val upcomingLots: List<AuctionLot>,
    val completedLots: List<AuctionLot>,
    val lots: List<AuctionLot>
) {
    companion object {
        fun fromJson(json: JSONObject): AuctionDetail = AuctionDetail(
            id = json.optInt("id"),
            title = json.optString("title"),
            scheduledAt = json.optString("scheduled_at"),
            category = json.optString("category"),
            currency = json.optString("currency"),
            location = json.optString("location"),
            auctioneerName = json.optString("auctioneer_name"),
            canBid = json.optBoolean("can_bid"),
            blockReason = json.optString("block_reason").takeIf { it.isNotBlank() },
            currentLot = json.optJSONObject("current_lot")?.let(AuctionLot::fromJson),
            upcomingLots = json.optJSONArray("upcoming_lots").toObjectList(AuctionLot::fromJson),
            completedLots = json.optJSONArray("completed_lots").toObjectList(AuctionLot::fromJson),
            lots = json.optJSONArray("lots").toObjectList(AuctionLot::fromJson)
        )
    }
}

data class JoinAuctionResult(
    val connected: Boolean,
    val blockReason: String?
) {
    companion object {
        fun fromJson(json: JSONObject): JoinAuctionResult = JoinAuctionResult(
            connected = json.optBoolean("connected"),
            blockReason = json.optString("block_reason").takeIf { it.isNotBlank() }
        )
    }
}

data class ActiveAuction(
    val auctionId: Int,
    val title: String,
    val category: String,
    val currency: String,
    val currentLotTitle: String?,
    val currentPrice: Double?
) {
    companion object {
        fun fromJson(json: JSONObject): ActiveAuction = ActiveAuction(
            auctionId = json.optInt("auction_id"),
            title = json.optString("title"),
            category = json.optString("category"),
            currency = json.optString("currency"),
            currentLotTitle = json.optString("current_lot_title").takeIf { it.isNotBlank() },
            currentPrice = json.optDouble("current_price").takeIf { !it.isNaN() && (it != 0.0 || json.has("current_price")) }
        )
    }
}

data class LeaveAuctionResult(
    val message: String
) {
    companion object {
        fun fromJson(json: JSONObject): LeaveAuctionResult = LeaveAuctionResult(
            message = json.optString("message")
        )
    }
}

data class PaymentMethod(
    val displayName: String,
    val currency: String,
    val status: String,
    val issuingBank: String?,
    val lastFour: String?
) {
    companion object {
        fun fromJson(json: JSONObject): PaymentMethod = PaymentMethod(
            displayName = json.optString("display_name"),
            currency = json.optString("currency"),
            status = json.optString("status"),
            issuingBank = json.optString("issuing_bank").takeIf { it.isNotBlank() },
            lastFour = json.optString("last_four").takeIf { it.isNotBlank() }
        )
    }
}

data class Metrics(
    val auctionsJoined: Int,
    val auctionsWon: Int,
    val activeBids: Int
) {
    companion object {
        fun fromJson(json: JSONObject): Metrics = Metrics(
            auctionsJoined = json.optInt("auctions_joined"),
            auctionsWon = json.optInt("auctions_won"),
            activeBids = json.optInt("active_bids")
        )
    }
}

private fun JSONArray?.toStringList(): List<String> {
    if (this == null) return emptyList()
    val values = mutableListOf<String>()
    for (index in 0 until length()) {
        val value = optString(index)
        if (value.isNotBlank()) {
            values += value
        }
    }
    return values
}

private fun <T> JSONArray?.toObjectList(transform: (JSONObject) -> T): List<T> {
    if (this == null) return emptyList()
    val values = mutableListOf<T>()
    for (index in 0 until length()) {
        val item = optJSONObject(index) ?: continue
        values += transform(item)
    }
    return values
}
