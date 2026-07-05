package com.anonymous.sistemadesubastas.nativeapp.data.repository

import com.anonymous.sistemadesubastas.nativeapp.data.model.Consignment
import com.anonymous.sistemadesubastas.nativeapp.data.model.MessageThread
import com.anonymous.sistemadesubastas.nativeapp.data.model.Metrics
import com.anonymous.sistemadesubastas.nativeapp.data.model.PaymentMethod
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile
import com.anonymous.sistemadesubastas.nativeapp.data.network.ApiClient
import org.json.JSONArray
import org.json.JSONObject

class ProfileRepository(private val apiClient: ApiClient) {
    fun profile(): UserProfile = UserProfile.fromJson(apiClient.get("/auth/profile"))

    fun updateProfile(
        firstName: String,
        lastName: String,
        email: String,
        legalAddress: String,
    ): UserProfile {
        val payload = JSONObject()
            .put("first_name", firstName)
            .put("last_name", lastName)
            .put("email", email)
            .put("legal_address", legalAddress)
        return UserProfile.fromJson(apiClient.post("/auth/profile", payload))
    }

    fun updateAvatar(avatarImageUrl: String): UserProfile {
        val payload = JSONObject()
            .put("avatar_image_url", avatarImageUrl)
        return UserProfile.fromJson(apiClient.post("/auth/profile/avatar", payload))
    }

    fun metrics(): Metrics = Metrics.fromJson(apiClient.get("/metricas/personal"))

    fun paymentMethods(): List<PaymentMethod> = parsePaymentArray(apiClient.getArray("/payment-methods"))

    fun createPaymentMethod(payload: JSONObject): PaymentMethod {
        return PaymentMethod.fromJson(apiClient.post("/payment-methods", payload))
    }

    fun deletePaymentMethod(paymentId: Int): String {
        val response = apiClient.delete("/payment-methods/$paymentId")
        return response.optString("message", "El medio de pago fue eliminado correctamente.")
    }

    fun consignments(): List<Consignment> = parseConsignmentArray(apiClient.getArray("/consignaciones"))

    fun createConsignment(payload: JSONObject): Consignment {
        return Consignment.fromJson(apiClient.post("/consignaciones", payload))
    }

    fun messageThreads(): List<MessageThread> = parseMessageThreadArray(apiClient.getArray("/mensajes"))

    fun messageThread(threadId: Int): MessageThread = MessageThread.fromJson(apiClient.get("/mensajes/$threadId"))

    fun sendMessage(threadId: Int, body: String): MessageThread {
        val payload = JSONObject()
            .put("body", body)
        return MessageThread.fromJson(apiClient.post("/mensajes/$threadId", payload))
    }

    fun decideConsignmentProposal(consignmentId: Int, accept: Boolean, payoutAccount: String?): Consignment {
        val payload = JSONObject()
            .put("accept", accept)
        if (!payoutAccount.isNullOrBlank()) {
            payload.put("payout_account", payoutAccount)
        }
        return Consignment.fromJson(apiClient.post("/consignaciones/$consignmentId/propuesta", payload))
    }

    private fun parsePaymentArray(array: JSONArray): List<PaymentMethod> {
        val values = mutableListOf<PaymentMethod>()
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            values += PaymentMethod.fromJson(item)
        }
        return values
    }

    private fun parseConsignmentArray(array: JSONArray): List<Consignment> {
        val values = mutableListOf<Consignment>()
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            values += Consignment.fromJson(item)
        }
        return values
    }

    private fun parseMessageThreadArray(array: JSONArray): List<MessageThread> {
        val values = mutableListOf<MessageThread>()
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            values += MessageThread.fromJson(item)
        }
        return values
    }
}
