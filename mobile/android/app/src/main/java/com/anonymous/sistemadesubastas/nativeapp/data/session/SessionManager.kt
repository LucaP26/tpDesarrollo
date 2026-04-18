package com.anonymous.sistemadesubastas.nativeapp.data.session

import android.content.Context
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile

class SessionManager(context: Context) {
    private val preferences = context.getSharedPreferences("curator_session", Context.MODE_PRIVATE)

    fun saveSession(token: String, user: UserProfile) {
        preferences.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_EMAIL, user.email)
            .putString(KEY_FULL_NAME, user.fullName)
            .putString(KEY_CATEGORY, user.category)
            .putString(KEY_ADDRESS, user.legalAddress)
            .putString(KEY_AVATAR, user.avatarImageUrl)
            .apply()
    }

    fun clear() {
        preferences.edit().clear().apply()
    }

    fun token(): String? = preferences.getString(KEY_TOKEN, null)

    fun isLoggedIn(): Boolean = !token().isNullOrBlank()

    fun hasNetworkConsent(): Boolean = preferences.getBoolean(KEY_NETWORK_CONSENT, false)

    fun setNetworkConsent(allowed: Boolean) {
        preferences.edit().putBoolean(KEY_NETWORK_CONSENT, allowed).apply()
    }

    fun userSnapshot(): UserProfile? {
        val token = token() ?: return null
        if (token.isBlank()) return null
        return UserProfile(
            email = preferences.getString(KEY_EMAIL, "").orEmpty(),
            fullName = preferences.getString(KEY_FULL_NAME, "").orEmpty(),
            legalAddress = preferences.getString(KEY_ADDRESS, "").orEmpty(),
            category = preferences.getString(KEY_CATEGORY, "comun").orEmpty(),
            avatarImageUrl = preferences.getString(KEY_AVATAR, null)
        )
    }

    private companion object {
        const val KEY_TOKEN = "token"
        const val KEY_NETWORK_CONSENT = "network_consent"
        const val KEY_EMAIL = "email"
        const val KEY_FULL_NAME = "full_name"
        const val KEY_CATEGORY = "category"
        const val KEY_ADDRESS = "legal_address"
        const val KEY_AVATAR = "avatar"
    }
}
