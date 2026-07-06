package com.anonymous.sistemadesubastas.nativeapp.ui.auth

import android.content.Intent
import android.os.Bundle
import com.anonymous.sistemadesubastas.databinding.ActivityRegistrationVerificationBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuthRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity

class RegistrationVerificationActivity : BaseActivity() {
    private lateinit var binding: ActivityRegistrationVerificationBinding
    private val authRepository by lazy { AuthRepository(apiClient) }
    private var submissionStarted = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRegistrationVerificationBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.backToLoginButton.setOnClickListener {
            goToLogin()
        }

        if (PendingRegistrationSubmissionStore.current == null) {
            alert(
                "Registro no disponible",
                "No encontramos la informacion del registro para verificar. Intenta nuevamente.",
            ) {
                finish()
            }
            return
        }

        startRegistrationSubmission()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    override fun shouldRequestMobileDataConsent(): Boolean = false

    private fun startRegistrationSubmission() {
        if (submissionStarted) {
            return
        }
        val submission = PendingRegistrationSubmissionStore.current ?: return
        submissionStarted = true

        AppExecutors.ioThenMain(
            task = {
                authRepository.registerOnboarding(
                    email = submission.email,
                    documentNumber = submission.documentNumber,
                    firstName = submission.firstName,
                    lastName = submission.lastName,
                    gender = submission.gender,
                    birthDateIso = submission.birthDateIso,
                    legalAddress = submission.legalAddress,
                    countryCode = submission.countryCode,
                    countryIsoCode = submission.countryIsoCode,
                    documentFrontImage = submission.documentFrontImage,
                    documentBackImage = submission.documentBackImage,
                )
            },
            onSuccess = {
                PendingRegistrationSubmissionStore.current = null
            },
            onError = { throwable ->
                submissionStarted = false
                alert(
                    "No se pudo completar el registro",
                    throwable.message ?: "No pudimos enviar la solicitud de registro. Intenta nuevamente.",
                ) {
                    finish()
                }
            },
        )
    }

    private fun goToLogin() {
        PendingRegistrationSubmissionStore.current = null
        startActivity(
            Intent(this, LoginActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK),
        )
        finish()
    }
}
