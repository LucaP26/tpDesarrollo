package com.anonymous.sistemadesubastas.nativeapp.ui.auth

import android.content.Intent
import android.os.Bundle
import com.anonymous.sistemadesubastas.databinding.ActivityLoginBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuthRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.home.HomeActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.auctions.AuctionsActivity
import com.anonymous.sistemadesubastas.nativeapp.system.NetworkStatus

class LoginActivity : BaseActivity() {
    private lateinit var binding: ActivityLoginBinding
    private val authRepository by lazy { AuthRepository(apiClient) }
    private var latestNetworkStatus: NetworkStatus = NetworkStatus.disconnected()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.emailInput.setText("p@gmail.com")
        binding.passwordInput.setText("Platino123!")

        binding.loginButton.setOnClickListener { submitLogin() }
        binding.publicCatalogsButton.setOnClickListener {
            startActivity(
                Intent(this, AuctionsActivity::class.java)
                    .putExtra(AuctionsActivity.EXTRA_PUBLIC_MODE, true)
            )
        }
        binding.forgotButton.setOnClickListener {
            startActivity(Intent(this, ForgotPasswordActivity::class.java))
        }
        binding.registerButton.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }

        updateNetworkStatusUi()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    override fun shouldRequestMobileDataConsent(): Boolean = false

    override fun onNetworkStatusChanged(status: NetworkStatus) {
        latestNetworkStatus = status
        updateNetworkStatusUi()
    }

    private fun submitLogin() {
        val email = binding.emailInput.text?.toString()?.trim().orEmpty()
        val password = binding.passwordInput.text?.toString().orEmpty()

        if (!email.contains("@")) {
            alert("Mail invalido", "Ingresa un correo electronico valido para continuar.")
            return
        }
        if (password.isBlank()) {
            alert("Contrasena requerida", "Ingresa tu contrasena para iniciar sesion.")
            return
        }
        if (!canUseCurrentNetwork(latestNetworkStatus)) {
            alert(
                "Sin conexion",
                "Necesitas una conexion activa para iniciar sesion."
            )
            return
        }

        setLoading(true)
        AppExecutors.ioThenMain(
            task = { authRepository.login(email, password) },
            onSuccess = { response ->
                sessionManager.saveSession(response.accessToken, response.user)
                setLoading(false)
                startActivity(
                    Intent(this, HomeActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                finish()
            },
            onError = { throwable ->
                setLoading(false)
                alert(
                    "No se pudo iniciar sesion",
                    throwable.message ?: "No pudimos conectar con el servidor."
                )
            }
        )
    }

    private fun setLoading(isLoading: Boolean) {
        if (isLoading) {
            binding.loginButton.isEnabled = false
            binding.loginButton.text = "Ingresando..."
        } else {
            binding.loginButton.text = "Entrar a la plataforma"
            updateNetworkStatusUi()
        }
    }

    private fun updateNetworkStatusUi() {
        val canLogin = canUseCurrentNetwork(latestNetworkStatus)
        binding.loginButton.isEnabled = canLogin
        binding.loginButton.alpha = if (canLogin) 1f else 0.6f
    }
}
