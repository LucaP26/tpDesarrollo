package com.anonymous.sistemadesubastas.nativeapp.data.model

import org.json.JSONArray
import org.json.JSONObject

data class UserProfile(
    val id: Int,
    val email: String,
    val firstName: String,
    val lastName: String,
    val legalAddress: String,
    val category: String,
    val avatarImageUrl: String?
) {
    val fullName: String
        get() = listOf(firstName, lastName).filter { it.isNotBlank() }.joinToString(" ").ifBlank { email }

    companion object {
        fun fromJson(json: JSONObject): UserProfile {
            val rawFirstName = json.optString("first_name")
            val rawLastName = json.optString("last_name")
            val nameParts = NameParts.from(
                firstName = rawFirstName,
                lastName = rawLastName,
                fullName = json.optString("full_name"),
            )
            return UserProfile(
                id = json.optInt("id"),
                email = json.optString("email"),
                firstName = nameParts.firstName,
                lastName = nameParts.lastName,
                legalAddress = json.optString("legal_address"),
                category = json.optString("category", "comun"),
                avatarImageUrl = json.optString("avatar_image_url").takeIf { it.isNotBlank() }
            )
        }
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
    val state: String,
    val category: String,
    val currency: String,
    val location: String,
    val auctioneerName: String,
    val canViewCatalog: Boolean,
    val connected: Boolean,
    val canBid: Boolean,
    val viewBlockReason: String?,
    val bestOffer: Double?,
    val previewLotTitle: String?,
    val previewImageUrl: String?,
    val previewBasePrice: Double?,
    val priceAvailable: Boolean,
    val totalLots: Int,
    val searchableTerms: List<String>,
    val inWatchlist: Boolean
) {
    companion object {
        fun fromJson(json: JSONObject): AuctionSummary = AuctionSummary(
            id = json.optInt("id"),
            title = json.optString("title"),
            scheduledAt = json.optString("scheduled_at"),
            state = json.optString("state"),
            category = json.optString("category"),
            currency = json.optString("currency"),
            location = json.optString("location"),
            auctioneerName = json.optString("auctioneer_name"),
            canViewCatalog = json.optBoolean("can_view_catalog"),
            connected = json.optBoolean("connected"),
            canBid = json.optBoolean("can_bid"),
            viewBlockReason = json.optString("view_block_reason").takeIf { it.isNotBlank() },
            bestOffer = json.optionalDouble("best_offer"),
            previewLotTitle = json.optString("preview_lot_title").takeIf { it.isNotBlank() },
            previewImageUrl = json.optString("preview_image_url").takeIf { it.isNotBlank() },
            previewBasePrice = json.optionalDouble("preview_base_price"),
            priceAvailable = json.optBoolean("price_available", true),
            totalLots = json.optInt("total_lots"),
            searchableTerms = json.optJSONArray("searchable_terms").toStringList(),
            inWatchlist = json.optBoolean("in_watchlist", false)
        )
    }
}

data class AppNotification(
    val id: Int,
    val title: String,
    val message: String,
    val kind: String,
    val createdAt: String,
    val read: Boolean
) {
    companion object {
        fun fromJson(json: JSONObject): AppNotification = AppNotification(
            id = json.optInt("id"),
            title = json.optString("title"),
            message = json.optString("message"),
            kind = json.optString("kind"),
            createdAt = json.optString("created_at"),
            read = json.optBoolean("read")
        )
    }
}

data class CorrespondenceMessage(
    val id: Int,
    val threadId: Int,
    val senderType: String,
    val senderUserId: Int?,
    val body: String,
    val createdAt: String
) {
    companion object {
        fun fromJson(json: JSONObject): CorrespondenceMessage = CorrespondenceMessage(
            id = json.optInt("id"),
            threadId = json.optInt("thread_id"),
            senderType = json.optString("sender_type"),
            senderUserId = json.optionalInt("sender_user_id"),
            body = json.optString("body"),
            createdAt = json.optString("created_at")
        )
    }
}

data class MessageThread(
    val id: Int,
    val consignmentId: Int?,
    val subject: String,
    val status: String,
    val updatedAt: String,
    val lastMessage: CorrespondenceMessage?,
    val messages: List<CorrespondenceMessage>
) {
    companion object {
        fun fromJson(json: JSONObject): MessageThread = MessageThread(
            id = json.optInt("id"),
            consignmentId = json.optionalInt("consignment_id"),
            subject = json.optString("subject"),
            status = json.optString("status"),
            updatedAt = json.optString("updated_at"),
            lastMessage = json.optJSONObject("last_message")?.let { CorrespondenceMessage.fromJson(it) },
            messages = json.optJSONArray("messages").toMessageList()
        )
    }
}

data class PublicBid(
    val amount: Double,
    val status: String,
    val createdAt: String,
    val isMine: Boolean
) {
    companion object {
        fun fromJson(json: JSONObject): PublicBid = PublicBid(
            amount = json.optDouble("amount"),
            status = json.optString("status"),
            createdAt = json.optString("created_at"),
            isMine = json.optBoolean("is_mine")
        )
    }
}

data class AuctionLot(
    val id: Int,
    val pieceNumber: String,
    val title: String,
    val description: String,
    val story: String?,
    val artist: String?,
    val ownerUserId: Int,
    val ownerName: String?,
    val imageUrls: List<String>,
    val basePrice: Double,
    val priceAvailable: Boolean,
    val currentBid: Double?,
    val bidHistory: List<PublicBid>,
    val bidSecondsRemaining: Int?,
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
            story = json.optString("story").takeIf { it.isNotBlank() },
            artist = json.optString("artist").takeIf { it.isNotBlank() },
            ownerUserId = json.optInt("owner_user_id"),
            ownerName = json.optString("owner_name").takeIf { it.isNotBlank() },
            imageUrls = json.optJSONArray("image_urls").toStringList(),
            basePrice = json.optDouble("base_price"),
            priceAvailable = json.optBoolean("price_available", true),
            currentBid = json.optionalDouble("current_bid"),
            bidHistory = json.optJSONArray("bid_history").toObjectList(PublicBid::fromJson),
            bidSecondsRemaining = if (json.has("bid_seconds_remaining") && !json.isNull("bid_seconds_remaining")) {
                json.optInt("bid_seconds_remaining")
            } else {
                null
            },
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
    val state: String,
    val category: String,
    val currency: String,
    val location: String,
    val auctioneerName: String,
    val connected: Boolean,
    val canBid: Boolean,
    val blockReason: String?,
    val priceAvailable: Boolean,
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
            state = json.optString("state"),
            category = json.optString("category"),
            currency = json.optString("currency"),
            location = json.optString("location"),
            auctioneerName = json.optString("auctioneer_name"),
            connected = json.optBoolean("connected"),
            canBid = json.optBoolean("can_bid"),
            blockReason = json.optString("block_reason").takeIf { it.isNotBlank() },
            priceAvailable = json.optBoolean("price_available", true),
            currentLot = json.optJSONObject("current_lot")?.let(AuctionLot::fromJson),
            upcomingLots = json.optJSONArray("upcoming_lots").toObjectList(AuctionLot::fromJson),
            completedLots = json.optJSONArray("completed_lots").toObjectList(AuctionLot::fromJson),
            lots = json.optJSONArray("lots").toObjectList(AuctionLot::fromJson)
        )
    }
}

data class JoinAuctionResult(
    val connected: Boolean,
    val canBid: Boolean,
    val blockReason: String?
) {
    companion object {
        fun fromJson(json: JSONObject): JoinAuctionResult = JoinAuctionResult(
            connected = json.optBoolean("connected"),
            canBid = json.optBoolean("can_bid"),
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
            currentPrice = json.optionalDouble("current_price")
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
    val id: Int,
    val type: String,
    val displayName: String,
    val currency: String,
    val status: String,
    val issuingBank: String?,
    val lastFour: String?,
    val holderFirstName: String?,
    val holderLastName: String?,
    val expirationDate: String?,
    val availableAmount: Double?
) {
    companion object {
        fun fromJson(json: JSONObject): PaymentMethod = PaymentMethod(
            id = json.optInt("id"),
            type = json.optString("type"),
            displayName = json.optString("display_name"),
            currency = json.optString("currency"),
            status = json.optString("status"),
            issuingBank = json.optString("issuing_bank").takeIf { it.isNotBlank() },
            lastFour = json.optString("last_four").takeIf { it.isNotBlank() },
            holderFirstName = json.optString("holder_first_name").takeIf { it.isNotBlank() },
            holderLastName = json.optString("holder_last_name").takeIf { it.isNotBlank() },
            expirationDate = json.optString("expiration_date").takeIf { it.isNotBlank() },
            availableAmount = json.optionalDouble("available_amount")
        )
    }
}

private data class NameParts(
    val firstName: String,
    val lastName: String,
) {
    companion object {
        fun from(firstName: String, lastName: String, fullName: String): NameParts {
            if (firstName.isNotBlank() || lastName.isNotBlank()) {
                return NameParts(firstName = firstName, lastName = lastName)
            }
            val tokens = fullName.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
            if (tokens.isEmpty()) {
                return NameParts(firstName = "", lastName = "")
            }
            if (tokens.size == 1) {
                return NameParts(firstName = tokens.first(), lastName = "")
            }
            return NameParts(
                firstName = tokens.first(),
                lastName = tokens.drop(1).joinToString(" "),
            )
        }
    }
}

data class Metrics(
    val auctionsJoined: Int,
    val auctionsWon: Int,
    val activeBids: Int,
    val totalAmountBid: Double,
    val totalAmountPaid: Double,
    val categoriesJoined: Map<String, Int>
) {
    companion object {
        fun fromJson(json: JSONObject): Metrics = Metrics(
            auctionsJoined = json.optInt("auctions_joined"),
            auctionsWon = json.optInt("auctions_won"),
            activeBids = json.optInt("active_bids"),
            totalAmountBid = json.optDouble("total_amount_bid"),
            totalAmountPaid = json.optDouble("total_amount_paid"),
            categoriesJoined = json.optJSONObject("categories_joined")?.let { values ->
                values.keys().asSequence().associateWith { key -> values.optInt(key) }
            }.orEmpty()
        )
    }
}

data class Consignment(
    val id: Int,
    val title: String,
    val description: String,
    val status: String,
    val rejectionReason: String?,
    val proposedBasePrice: Double?,
    val commissionRate: Double?,
    val assignedAuctionId: Int?,
    val assignedAuctionTitle: String?,
    val assignedAuctionScheduledAt: String?,
    val assignedAuctionLocation: String?,
    val assignedAuctionAuctioneerName: String?,
    val storageLocation: String?,
    val insurancePolicy: String?,
    val inspectionAddress: String?,
    val returnShippingCost: Double?,
    val returnShippingNote: String?,
    val originDoubtReported: Boolean,
    val originDoubtNotes: String?,
    val itemCount: Int,
    val collectionName: String?,
    val payoutAccount: String?,
    val photos: List<String>
) {
    companion object {
        fun fromJson(json: JSONObject): Consignment = Consignment(
            id = json.optInt("id"),
            title = json.optString("title"),
            description = json.optString("description"),
            status = json.optString("status"),
            rejectionReason = json.optString("rejection_reason").takeIf { it.isNotBlank() },
            proposedBasePrice = json.optionalDouble("proposed_base_price"),
            commissionRate = json.optionalDouble("commission_rate"),
            assignedAuctionId = json.optionalInt("assigned_auction_id"),
            assignedAuctionTitle = json.optString("assigned_auction_title").takeIf { it.isNotBlank() },
            assignedAuctionScheduledAt = json.optString("assigned_auction_scheduled_at").takeIf { it.isNotBlank() },
            assignedAuctionLocation = json.optString("assigned_auction_location").takeIf { it.isNotBlank() },
            assignedAuctionAuctioneerName = json.optString("assigned_auction_auctioneer_name").takeIf { it.isNotBlank() },
            storageLocation = json.optString("storage_location").takeIf { it.isNotBlank() },
            insurancePolicy = json.optString("insurance_policy").takeIf { it.isNotBlank() },
            inspectionAddress = json.optString("inspection_address").takeIf { it.isNotBlank() },
            returnShippingCost = json.optionalDouble("return_shipping_cost"),
            returnShippingNote = json.optString("return_shipping_note").takeIf { it.isNotBlank() },
            originDoubtReported = json.optBoolean("origin_doubt_reported"),
            originDoubtNotes = json.optString("origin_doubt_notes").takeIf { it.isNotBlank() },
            itemCount = json.optInt("item_count", 1),
            collectionName = json.optString("collection_name").takeIf { it.isNotBlank() },
            payoutAccount = json.optString("payout_account").takeIf { it.isNotBlank() },
            photos = json.optJSONArray("photos").toStringList()
        )
    }
}

private fun JSONObject.optionalDouble(key: String): Double? {
    if (!has(key) || isNull(key)) {
        return null
    }
    return optDouble(key).takeIf { it.isFinite() }
}

private fun JSONObject.optionalInt(key: String): Int? {
    if (!has(key) || isNull(key)) {
        return null
    }
    return optInt(key)
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

private fun JSONArray?.toMessageList(): List<CorrespondenceMessage> {
    if (this == null) return emptyList()
    val values = mutableListOf<CorrespondenceMessage>()
    for (index in 0 until length()) {
        val value = optJSONObject(index) ?: continue
        values += CorrespondenceMessage.fromJson(value)
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
