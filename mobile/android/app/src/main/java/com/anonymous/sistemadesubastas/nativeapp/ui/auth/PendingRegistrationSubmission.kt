package com.anonymous.sistemadesubastas.nativeapp.ui.auth

data class PendingRegistrationSubmission(
    val email: String,
    val firstName: String,
    val lastName: String,
    val gender: String,
    val birthDateIso: String,
    val legalAddress: String,
    val countryCode: Int,
    val countryIsoCode: String,
    val documentFrontImage: String,
    val documentBackImage: String,
    val paymentType: String,
    val paymentDisplayName: String,
    val paymentCurrency: String,
    val paymentIssuerCountry: String,
    val paymentAvailableAmount: Double,
    val paymentLastFour: String? = null,
    val paymentIssuingBank: String? = null,
    val paymentExpirationDate: String? = null,
)

object PendingRegistrationSubmissionStore {
    var current: PendingRegistrationSubmission? = null
}
