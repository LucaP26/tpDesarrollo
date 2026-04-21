package com.anonymous.sistemadesubastas.nativeapp.data.session

import android.content.Context
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile

class SessionManager(context: Context) {
    private val preferences = context.getSharedPreferences("atelier_session", Context.MODE_PRIVATE)

    fun saveSession(token: String, user: UserProfile) {
        preferences.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_EMAIL, user.email)
            .putInt(KEY_USER_ID, user.id)
            .putString(KEY_FIRST_NAME, user.firstName)
            .putString(KEY_LAST_NAME, user.lastName)
            .putString(KEY_FULL_NAME, user.fullName)
            .putString(KEY_CATEGORY, user.category)
            .putString(KEY_ADDRESS, user.legalAddress)
            .putString(KEY_AVATAR, user.avatarImageUrl)
            .apply()
    }

    fun clear(preserveMobileDataConsent: Boolean = true) {
        val mobileDataConsent = if (preserveMobileDataConsent) hasMobileDataConsent() else false
        preferences.edit()
            .clear()
            .apply {
                if (preserveMobileDataConsent && mobileDataConsent) {
                    putBoolean(KEY_MOBILE_DATA_CONSENT, true)
                }
            }
            .apply()
    }

    fun token(): String? = preferences.getString(KEY_TOKEN, null)

    fun isLoggedIn(): Boolean = !token().isNullOrBlank()

    fun hasMobileDataConsent(): Boolean = preferences.getBoolean(
        KEY_MOBILE_DATA_CONSENT,
        preferences.getBoolean(KEY_LEGACY_NETWORK_CONSENT, false)
    )

    fun setMobileDataConsent(allowed: Boolean) {
        preferences.edit()
            .putBoolean(KEY_MOBILE_DATA_CONSENT, allowed)
            .apply()
    }

    fun userSnapshot(): UserProfile? {
        val token = token() ?: return null
        if (token.isBlank()) return null
        val storedFirstName = preferences.getString(KEY_FIRST_NAME, "").orEmpty()
        val storedLastName = preferences.getString(KEY_LAST_NAME, "").orEmpty()
        val fullName = preferences.getString(KEY_FULL_NAME, "").orEmpty().trim()
        val fallbackNameParts = splitFullName(fullName)
        return UserProfile(
            id = preferences.getInt(KEY_USER_ID, 0),
            email = preferences.getString(KEY_EMAIL, "").orEmpty(),
            firstName = storedFirstName.ifBlank { fallbackNameParts.first },
            lastName = storedLastName.ifBlank { fallbackNameParts.second },
            legalAddress = preferences.getString(KEY_ADDRESS, "").orEmpty(),
            category = preferences.getString(KEY_CATEGORY, "comun").orEmpty(),
            avatarImageUrl = preferences.getString(KEY_AVATAR, null)
        )
    }

    private fun splitFullName(fullName: String): Pair<String, String> {
        val tokens = fullName.split(Regex("\\s+")).filter { it.isNotBlank() }
        if (tokens.isEmpty()) {
            return "" to ""
        }
        if (tokens.size == 1) {
            return tokens.first() to ""
        }
        return tokens.first() to tokens.drop(1).joinToString(" ")
    }

    private companion object {
        const val KEY_TOKEN = "token"
        const val KEY_USER_ID = "user_id"
        const val KEY_MOBILE_DATA_CONSENT = "mobile_data_consent"
        const val KEY_LEGACY_NETWORK_CONSENT = "network_consent"
        const val KEY_EMAIL = "email"
        const val KEY_FIRST_NAME = "first_name"
        const val KEY_LAST_NAME = "last_name"
        const val KEY_FULL_NAME = "full_name"
        const val KEY_CATEGORY = "category"
        const val KEY_ADDRESS = "legal_address"
        const val KEY_AVATAR = "avatar"
    }
}
