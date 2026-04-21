package com.anonymous.sistemadesubastas.nativeapp.ui.auth

import android.os.Bundle
import com.anonymous.sistemadesubastas.databinding.ActivityChangePasswordBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuthRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity

class ChangePasswordActivity : BaseActivity() {
    private lateinit var binding: ActivityChangePasswordBinding
    private val authRepository by lazy { AuthRepository(apiClient) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }

        binding = ActivityChangePasswordBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.backButton.setOnClickListener { finish() }
        binding.submitButton.setOnClickListener { submitPasswordChange() }
    }

    override fun shouldMonitorNetwork(): Boolean = true

    private fun submitPasswordChange() {
        val currentPassword = binding.currentPasswordInput.text?.toString().orEmpty()
        val newPassword = binding.newPasswordInput.text?.toString().orEmpty()
        val confirmPassword = binding.confirmPasswordInput.text?.toString().orEmpty()

        if (currentPassword.isBlank()) {
            alert("Contrasena actual requerida", "Ingresa tu contrasena actual para continuar.")
            return
        }

        val passwordError = validatePassword(newPassword)
        if (passwordError != null) {
            alert("Contrasena invalida", passwordError)
            return
        }

        if (newPassword != confirmPassword) {
            alert("Contrasenas distintas", "La confirmacion no coincide con la nueva contrasena.")
            return
        }

        setLoading(true)
        AppExecutors.ioThenMain(
            task = { authRepository.changePassword(currentPassword, newPassword) },
            onSuccess = { message ->
                setLoading(false)
                alert("Contrasena actualizada", message) { finish() }
            },
            onError = { throwable ->
                setLoading(false)
                alert(
                    "No se pudo actualizar",
                    throwable.message ?: "Intenta nuevamente en unos instantes."
                )
            },
        )
    }

    private fun setLoading(isLoading: Boolean) {
        binding.submitButton.isEnabled = !isLoading
        binding.submitButton.text = if (isLoading) "Guardando..." else "Guardar contrasena"
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
