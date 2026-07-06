package com.anonymous.sistemadesubastas.nativeapp.data.network

import com.anonymous.sistemadesubastas.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

class AuctionRealtimeClient(
    private val tokenProvider: () -> String?,
    private val onBidUpdate: (JSONObject) -> Unit,
) {
    private val client = OkHttpClient()
    private var socket: WebSocket? = null
    private var auctionId: Int? = null

    fun connect(auctionId: Int) {
        if (this.auctionId == auctionId && socket != null) {
            return
        }
        disconnect()
        val token = tokenProvider().orEmpty()
        if (token.isBlank()) {
            return
        }
        this.auctionId = auctionId
        val request = Request.Builder()
            .url("${websocketBaseUrl()}/ws/subastas/$auctionId?token=$token")
            .build()
        socket = client.newWebSocket(
            request,
            object : WebSocketListener() {
                override fun onMessage(webSocket: WebSocket, text: String) {
                    val payload = runCatching { JSONObject(text) }.getOrNull() ?: return
                    if (payload.optString("type") == "bid.updated") {
                        onBidUpdate(payload)
                    }
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    if (socket == webSocket) {
                        socket = null
                    }
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    if (socket == webSocket) {
                        socket = null
                    }
                }
            },
        )
    }

    fun disconnect() {
        socket?.close(1000, "closed")
        socket = null
        auctionId = null
    }

    private fun websocketBaseUrl(): String {
        return BuildConfig.API_BASE_URL
            .removeSuffix("/api/v1")
            .replaceFirst("https://", "wss://")
            .replaceFirst("http://", "ws://")
    }
}
