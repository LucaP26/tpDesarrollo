package com.anonymous.sistemadesubastas.nativeapp.data.repository

import com.anonymous.sistemadesubastas.nativeapp.data.model.AuthResponse
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile
import com.anonymous.sistemadesubastas.nativeapp.data.network.ApiClient
import org.json.JSONObject

class AuthRepository(private val apiClient: ApiClient) {
    fun login(email: String, password: String): AuthResponse {
        val payload = JSONObject()
            .put("email", email)
            .put("password", password)
        return AuthResponse.fromJson(apiClient.post("/auth/login", payload, authenticated = false))
    }

    fun preRegister(
        email: String,
        firstName: String,
        lastName: String,
        legalAddress: String,
        countryCode: Int,
        documentFrontImage: String,
        documentBackImage: String
    ): Int {
        val payload = JSONObject()
            .put("email", email)
            .put("document_number", "TMP-${System.currentTimeMillis().toString().takeLast(6)}")
            .put("first_name", firstName)
            .put("last_name", lastName)
            .put("legal_address", legalAddress)
            .put("country_code", countryCode)
            .put("document_front_image_url", documentFrontImage)
            .put("document_back_image_url", documentBackImage)

        return apiClient.post("/auth/pre-register", payload, authenticated = false).optInt("user_id")
    }

    fun completeRegistration(userId: Int, password: String): AuthResponse {
        val payload = JSONObject()
            .put("user_id", userId)
            .put("password", password)
        return AuthResponse.fromJson(apiClient.post("/auth/complete-registration", payload, authenticated = false))
    }

    fun requestPasswordReset(email: String): String {
        val payload = JSONObject().put("email", email)
        val json = apiClient.post("/auth/password-reset/request", payload, authenticated = false)
        return json.optString("message", "Si el correo existe, enviaremos instrucciones.")
    }

    fun profile(): UserProfile {
        return UserProfile.fromJson(apiClient.get("/auth/profile"))
    }
}
