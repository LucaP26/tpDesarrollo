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

    fun registerOnboarding(
        email: String,
        firstName: String,
        lastName: String,
        gender: String,
        birthDateIso: String,
        legalAddress: String,
        countryCode: Int,
        countryIsoCode: String,
        documentFrontImage: String,
        documentBackImage: String,
        paymentType: String,
        paymentDisplayName: String,
        paymentCurrency: String,
        paymentIssuerCountry: String,
        paymentAvailableAmount: Double,
        paymentLastFour: String? = null,
        paymentIssuingBank: String? = null,
        paymentExpirationDate: String? = null
    ): String {
        val payload = JSONObject()
            .put("email", email)
            .put("document_number", "TMP-${System.currentTimeMillis().toString().takeLast(6)}")
            .put("first_name", firstName)
            .put("last_name", lastName)
            .put("gender", gender)
            .put("birth_date", birthDateIso)
            .put("legal_address", legalAddress)
            .put("country_code", countryCode)
            .put("document_front_image_url", documentFrontImage)
            .put("document_back_image_url", documentBackImage)
            .put(
                "payment_method",
                JSONObject()
                    .put("type", paymentType)
                    .put("display_name", paymentDisplayName)
                    .put("currency", paymentCurrency)
                    .put("issuer_country", paymentIssuerCountry)
                    .put("available_amount", paymentAvailableAmount)
                    .apply {
                        paymentLastFour?.let { put("last_four", it) }
                        paymentIssuingBank?.let { put("issuing_bank", it) }
                        paymentExpirationDate?.let { put("expiration_date", it) }
                    }
            )

        val response = apiClient.post("/auth/register-onboarding", payload, authenticated = false)
        return response.optString("message", "Te enviamos un correo para crear tu contrasena.")
    }

    fun completePasswordSetup(email: String, token: String, password: String): AuthResponse {
        val payload = JSONObject()
            .put("email", email)
            .put("token", token)
            .put("password", password)
        return AuthResponse.fromJson(apiClient.post("/auth/password-setup/complete", payload, authenticated = false))
    }

    fun requestPasswordReset(email: String): String {
        val payload = JSONObject().put("email", email)
        val json = apiClient.post("/auth/password-reset/request", payload, authenticated = false)
        return json.optString("message", "Si el correo existe, enviaremos instrucciones.")
    }

    fun changePassword(currentPassword: String, newPassword: String): String {
        val payload = JSONObject()
            .put("current_password", currentPassword)
            .put("new_password", newPassword)
        val json = apiClient.post("/auth/password/change", payload)
        return json.optString("message", "Tu contrasena fue actualizada correctamente.")
    }

    fun profile(): UserProfile {
        return UserProfile.fromJson(apiClient.get("/auth/profile"))
    }
}
