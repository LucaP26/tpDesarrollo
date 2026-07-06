package com.anonymous.sistemadesubastas.nativeapp.data.repository

import com.anonymous.sistemadesubastas.nativeapp.data.model.AuctionDetail
import com.anonymous.sistemadesubastas.nativeapp.data.model.AuctionSummary
import com.anonymous.sistemadesubastas.nativeapp.data.model.ActiveAuction
import com.anonymous.sistemadesubastas.nativeapp.data.model.AppNotification
import com.anonymous.sistemadesubastas.nativeapp.data.model.JoinAuctionResult
import com.anonymous.sistemadesubastas.nativeapp.data.model.LeaveAuctionResult
import com.anonymous.sistemadesubastas.nativeapp.data.network.ApiClient
import org.json.JSONArray
import org.json.JSONObject

class AuctionRepository(private val apiClient: ApiClient) {
    fun listAuctions(): List<AuctionSummary> {
        return parseAuctionArray(apiClient.getArray("/subastas"))
    }

    fun listPublicAuctions(): List<AuctionSummary> {
        return parseAuctionArray(apiClient.getArray("/catalogos-publicos", authenticated = false))
    }

    fun watchlist(): List<AuctionSummary> {
        return parseAuctionArray(apiClient.getArray("/watchlist"))
    }

    fun addToWatchlist(auctionId: Int) {
        apiClient.post("/watchlist/$auctionId", JSONObject())
    }

    fun removeFromWatchlist(auctionId: Int) {
        apiClient.delete("/watchlist/$auctionId")
    }

    fun notifications(): List<AppNotification> {
        val array = apiClient.getArray("/notificaciones")
        val notifications = mutableListOf<AppNotification>()
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            notifications += AppNotification.fromJson(item)
        }
        return notifications
    }

    fun markNotificationRead(notificationId: Int) {
        apiClient.post("/notificaciones/$notificationId/leida", JSONObject())
    }

    fun activeAuction(): ActiveAuction? {
        return apiClient.getNullable("/subastas/activa")?.let(ActiveAuction::fromJson)
    }

    fun detail(auctionId: Int): AuctionDetail = AuctionDetail.fromJson(apiClient.get("/subastas/$auctionId"))

    fun publicDetail(auctionId: Int): AuctionDetail =
        AuctionDetail.fromJson(apiClient.get("/catalogos-publicos/$auctionId", authenticated = false))

    fun join(auctionId: Int): JoinAuctionResult =
        JoinAuctionResult.fromJson(apiClient.post("/subastas/$auctionId/join", JSONObject()))

    fun leave(auctionId: Int): LeaveAuctionResult =
        LeaveAuctionResult.fromJson(apiClient.post("/subastas/$auctionId/abandonar", JSONObject()))

    fun bid(auctionId: Int, lotId: Int, amount: Double, paymentMethodId: Int?) {
        val payload = JSONObject().put("amount", amount)
        if (paymentMethodId != null) {
            payload.put("payment_method_id", paymentMethodId)
        }
        apiClient.post("/subastas/$auctionId/lotes/$lotId/pujas", payload)
    }

    private fun parseAuctionArray(array: JSONArray): List<AuctionSummary> {
        val auctions = mutableListOf<AuctionSummary>()
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            auctions += AuctionSummary.fromJson(item)
        }
        return auctions
    }
}
