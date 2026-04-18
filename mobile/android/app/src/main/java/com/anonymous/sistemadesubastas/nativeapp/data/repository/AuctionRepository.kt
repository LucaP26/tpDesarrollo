package com.anonymous.sistemadesubastas.nativeapp.data.repository

import com.anonymous.sistemadesubastas.nativeapp.data.model.AuctionDetail
import com.anonymous.sistemadesubastas.nativeapp.data.model.AuctionSummary
import com.anonymous.sistemadesubastas.nativeapp.data.model.ActiveAuction
import com.anonymous.sistemadesubastas.nativeapp.data.model.JoinAuctionResult
import com.anonymous.sistemadesubastas.nativeapp.data.model.LeaveAuctionResult
import com.anonymous.sistemadesubastas.nativeapp.data.network.ApiClient
import org.json.JSONArray
import org.json.JSONObject

class AuctionRepository(private val apiClient: ApiClient) {
    fun listAuctions(): List<AuctionSummary> {
        return parseAuctionArray(apiClient.getArray("/subastas"))
    }

    fun activeAuction(): ActiveAuction? {
        return apiClient.getNullable("/subastas/activa")?.let(ActiveAuction::fromJson)
    }

    fun detail(auctionId: Int): AuctionDetail = AuctionDetail.fromJson(apiClient.get("/subastas/$auctionId"))

    fun join(auctionId: Int): JoinAuctionResult =
        JoinAuctionResult.fromJson(apiClient.post("/subastas/$auctionId/join", JSONObject()))

    fun leave(auctionId: Int): LeaveAuctionResult =
        LeaveAuctionResult.fromJson(apiClient.post("/subastas/$auctionId/abandonar", JSONObject()))

    fun bid(auctionId: Int, lotId: Int, amount: Double) {
        val payload = JSONObject().put("amount", amount)
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
