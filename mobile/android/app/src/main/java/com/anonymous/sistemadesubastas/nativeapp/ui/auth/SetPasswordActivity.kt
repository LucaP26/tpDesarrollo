package com.anonymous.sistemadesubastas.nativeapp.ui.auth

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.anonymous.sistemadesubastas.databinding.ActivitySetPasswordBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuthRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.home.HomeActivity

class SetPasswordActivity : BaseActivity() {
    private lateinit var binding: ActivitySetPasswordBinding
    private val authRepository by lazy { AuthRepository(apiClient) }

    private var email: String = ""
    private var setupToken: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySetPasswordBinding.inflate(layoutInflater)
        setContentView(binding.root)

        readLinkData(intent?.data)
        if (email.isBlank() || setupToken.isBlank()) {
            alert(
                "Enlace invalido",
                "No pudimos validar el enlace para crear tu contrasena. Solicita uno nuevo desde la app.",
            ) {
                finish()
            }
            return
        }

        binding.emailValue.text = email
        binding.backButton.setOnClickListener { finish() }
        binding.submitButton.setOnClickListener { submitPassword() }
    }

    override fun shouldMonitorNetwork(): Boolean = true

    override fun shouldRequestMobileDataConsent(): Boolean = false

    private fun readLinkData(data: Uri?) {
        email = data?.getQueryParameter("email").orEmpty().trim().lowercase()
        setupToken = data?.getQueryParameter("token").orEmpty().trim()
    }

    private fun submitPassword() {
        val password = binding.passwordInput.text?.toString().orEmpty()
        val confirmPassword = binding.confirmPasswordInput.text?.toString().orEmpty()

        val passwordError = validatePassword(password)
        if (passwordError != null) {
            alert("Contrasena invalida", passwordError)
            return
        }
        if (password != confirmPassword) {
            alert("Contrasenas distintas", "La confirmacion no coincide con la contrasena ingresada.")
            return
        }

        setLoading(true)
        AppExecutors.ioThenMain(
            task = { authRepository.completePasswordSetup(email, setupToken, password) },
            onSuccess = { response ->
                sessionManager.saveSession(response.accessToken, response.user)
                setLoading(false)
                startActivity(
                    Intent(this, HomeActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK),
                )
                finish()
            },
            onError = { throwable ->
                setLoading(false)
                alert(
                    "No se pudo crear la contrasena",
                    throwable.message ?: "No pudimos completar la activacion de tu acceso.",
                )
            },
        )
    }

    private fun setLoading(isLoading: Boolean) {
        binding.submitButton.isEnabled = !isLoading
        binding.submitButton.text = if (isLoading) "Activando..." else "Crear contrasena"
    }

    private fun validatePassword(password: String): String? {
        if (password.length < 6) {
            return PASSWORD_RULES_MESSAGE
        }
        if (!LOWERCASE_REGEX.containsMatchIn(password)) {
            return PASSWORD_RULES_MESSAGE
        }
        if (!UPPERCASE_REGEX.containsMatchIn(password)) {
            return PASSWORD_RULES_MESSAGE
        }
        if (!NUMBER_REGEX.containsMatchIn(password)) {
            return PASSWORD_RULES_MESSAGE
        }
        if (!SYMBOL_REGEX.containsMatchIn(password)) {
            return PASSWORD_RULES_MESSAGE
        }
        return null
    }

    private companion object {
        const val PASSWORD_RULES_MESSAGE =
            "La contrasena debe tener al menos 6 caracteres e incluir una minuscula, una mayuscula, un numero y un simbolo."
        val LOWERCASE_REGEX = Regex("[a-z]")
        val UPPERCASE_REGEX = Regex("[A-Z]")
        val NUMBER_REGEX = Regex("[0-9]")
        val SYMBOL_REGEX = Regex("[^A-Za-z0-9]")
    }
}
