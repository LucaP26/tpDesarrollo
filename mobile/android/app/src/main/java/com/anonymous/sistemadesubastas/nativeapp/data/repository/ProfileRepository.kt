package com.anonymous.sistemadesubastas.nativeapp.data.repository

import com.anonymous.sistemadesubastas.nativeapp.data.model.Metrics
import com.anonymous.sistemadesubastas.nativeapp.data.model.PaymentMethod
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile
import com.anonymous.sistemadesubastas.nativeapp.data.network.ApiClient
import org.json.JSONArray
import org.json.JSONObject

class ProfileRepository(private val apiClient: ApiClient) {
    fun profile(): UserProfile = UserProfile.fromJson(apiClient.get("/auth/profile"))

    fun metrics(): Metrics = Metrics.fromJson(apiClient.get("/metricas/personal"))

    fun paymentMethods(): List<PaymentMethod> = parsePaymentArray(apiClient.getArray("/payment-methods"))

    fun createPaymentMethod(payload: JSONObject): PaymentMethod {
        return PaymentMethod.fromJson(apiClient.post("/payment-methods", payload))
    }

    private fun parsePaymentArray(array: JSONArray): List<PaymentMethod> {
        val values = mutableListOf<PaymentMethod>()
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            values += PaymentMethod.fromJson(item)
        }
        return values
    }
}
