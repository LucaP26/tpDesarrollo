package com.anonymous.sistemadesubastas.nativeapp.ui.auth

import android.os.Bundle
import com.anonymous.sistemadesubastas.databinding.ActivityForgotPasswordBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuthRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity

class ForgotPasswordActivity : BaseActivity() {
    private lateinit var binding: ActivityForgotPasswordBinding
    private val authRepository by lazy { AuthRepository(apiClient) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityForgotPasswordBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.backButton.setOnClickListener { finish() }
        binding.requestButton.setOnClickListener { requestRecovery() }
    }

    override fun shouldMonitorNetwork(): Boolean = true

    override fun shouldRequestMobileDataConsent(): Boolean = false

    private fun requestRecovery() {
        val email = binding.emailInput.text?.toString()?.trim().orEmpty()
        if (!email.contains("@")) {
            alert("Mail invalido", "Ingresa un correo electronico valido para solicitar el codigo.")
            return
        }

        setLoading(true)
        AppExecutors.ioThenMain(
            task = { authRepository.requestPasswordReset(email) },
            onSuccess = { message ->
                setLoading(false)
                alert("Solicitud enviada", message) { finish() }
            },
            onError = { throwable ->
                setLoading(false)
                alert("No se pudo enviar", throwable.message ?: "Intenta de nuevo en unos instantes.")
            }
        )
    }

    private fun setLoading(isLoading: Boolean) {
        binding.requestButton.isEnabled = !isLoading
        binding.requestButton.text = if (isLoading) "Enviando..." else "Enviar codigo"
    }
}
