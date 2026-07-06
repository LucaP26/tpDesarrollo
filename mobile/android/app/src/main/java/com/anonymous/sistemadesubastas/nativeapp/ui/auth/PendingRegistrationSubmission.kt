package com.anonymous.sistemadesubastas.nativeapp.ui.auth

data class PendingRegistrationSubmission(
    val email: String,
    val documentNumber: String,
    val firstName: String,
    val lastName: String,
    val gender: String,
    val birthDateIso: String,
    val legalAddress: String,
    val countryCode: Int,
    val countryIsoCode: String,
    val documentFrontImage: String,
    val documentBackImage: String,
)

object PendingRegistrationSubmissionStore {
    var current: PendingRegistrationSubmission? = null
}
