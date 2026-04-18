package com.anonymous.sistemadesubastas.nativeapp.ui.auth

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import com.anonymous.sistemadesubastas.databinding.ActivityLoginBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuthRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.home.HomeActivity
import com.anonymous.sistemadesubastas.nativeapp.system.NetworkStatus

class LoginActivity : BaseActivity() {
    private lateinit var binding: ActivityLoginBinding
    private val authRepository by lazy { AuthRepository(apiClient) }
    private var latestNetworkStatus: NetworkStatus = NetworkStatus.disconnected()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (sessionManager.isLoggedIn()) {
            startActivity(Intent(this, HomeActivity::class.java))
            finish()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.emailInput.setText("p@gmail.com")
        binding.passwordInput.setText("Platino123!")

        binding.networkStatusText.setOnClickListener {
            requestNetworkConsent(force = true)
        }
        binding.loginButton.setOnClickListener { submitLogin() }
        binding.forgotButton.setOnClickListener {
            startActivity(Intent(this, ForgotPasswordActivity::class.java))
        }
        binding.registerButton.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }

        updateNetworkStatusUi()
        if (!sessionManager.hasNetworkConsent()) {
            binding.root.post {
                requestNetworkConsent()
            }
        }
    }

    override fun shouldMonitorNetwork(): Boolean = true

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
        if (!sessionManager.hasNetworkConsent()) {
            requestNetworkConsent(force = true)
            return
        }
        if (!latestNetworkStatus.isConnected) {
            alert(
                "Sin conexion",
                "Necesitas red activa, ya sea Wi-Fi o datos moviles, para iniciar sesion."
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

    private fun requestNetworkConsent(force: Boolean = false) {
        if (!force && sessionManager.hasNetworkConsent()) {
            updateNetworkStatusUi()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("Acceso a la red")
            .setMessage(
                "CURATOR necesita acceder a la red de tu telefono, ya sea Wi-Fi o datos moviles, para iniciar sesion, cargar salas y mantener las pujas sincronizadas."
            )
            .setCancelable(false)
            .setNegativeButton("No permitir") { dialog, _ ->
                dialog.dismiss()
                sessionManager.setNetworkConsent(false)
                closeApplication()
            }
            .setPositiveButton("Permitir") { dialog, _ ->
                dialog.dismiss()
                sessionManager.setNetworkConsent(true)
                updateNetworkStatusUi()
            }
            .show()
    }

    private fun updateNetworkStatusUi() {
        val consentGranted = sessionManager.hasNetworkConsent()
        val statusMessage = when {
            !consentGranted -> "Debes permitir acceso a la red para continuar."
            latestNetworkStatus.isWifi -> "Red activa por Wi-Fi."
            latestNetworkStatus.isMobileData -> "Red activa por datos moviles."
            latestNetworkStatus.isConnected -> "Red activa."
            else -> "Sin conexion. Verifica Wi-Fi o datos moviles."
        }

        binding.networkStatusText.text = statusMessage
        binding.loginButton.isEnabled = consentGranted && latestNetworkStatus.isConnected
    }
}
