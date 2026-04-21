package com.anonymous.sistemadesubastas.nativeapp.ui.common

import android.content.Intent
import android.graphics.Typeface
import android.os.SystemClock
import android.util.TypedValue
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.anonymous.sistemadesubastas.R
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile
import com.anonymous.sistemadesubastas.nativeapp.data.network.ApiClient
import com.anonymous.sistemadesubastas.nativeapp.data.network.ApiException
import com.anonymous.sistemadesubastas.nativeapp.data.session.SessionManager
import com.anonymous.sistemadesubastas.nativeapp.system.NetworkResource
import com.anonymous.sistemadesubastas.nativeapp.system.NetworkStatus
import com.anonymous.sistemadesubastas.nativeapp.system.SystemServiceProvider
import com.anonymous.sistemadesubastas.nativeapp.ui.auth.LoginActivity

abstract class BaseActivity : AppCompatActivity() {
    protected val sessionManager: SessionManager by lazy { SessionManager(this) }
    protected val apiClient: ApiClient by lazy { ApiClient { sessionManager.token() } }
    protected val systemServices: SystemServiceProvider by lazy { SystemServiceProvider(this) }
    protected val networkResource: NetworkResource by lazy { NetworkResource(systemServices) }
    private var mobileDataDialog: AlertDialog? = null
    private var previousNetworkStatus: NetworkStatus? = null
    private var awaitingMobileConsentAfterWifiLoss: Boolean = false
    private var wifiStableSinceMs: Long? = null
    private var hasQualifiedWifiSession: Boolean = false
    private var pendingWifiLossConfirmation: Boolean = false

    protected fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    protected fun alert(title: String, message: String, onDismiss: (() -> Unit)? = null) {
        val titleView = TextView(this).apply {
            text = title
            setTextColor(ContextCompat.getColor(context, R.color.atelier_action))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(56, 42, 56, 0)
        }

        val dialog = AlertDialog.Builder(this)
            .setCustomTitle(titleView)
            .setMessage(message)
            .setPositiveButton("Entendido") { dialog, _ ->
                dialog.dismiss()
                onDismiss?.invoke()
            }
            .create()

        styleDialogButtons(dialog)
        dialog.show()
    }

    protected fun persistSessionUser(user: UserProfile) {
        sessionManager.token()?.let { token ->
            sessionManager.saveSession(token, user)
        }
    }

    protected fun showErrorOrHandleSession(
        title: String,
        throwable: Throwable,
        fallbackMessage: String,
        onDismiss: (() -> Unit)? = null
    ): Boolean {
        if (isSessionInvalid(throwable)) {
            alert(
                "Sesion vencida",
                "Tu sesion ya no es valida. Vuelve a iniciar sesion para continuar."
            ) {
                restartToLogin()
            }
            return true
        }

        alert(title, throwable.message ?: fallbackMessage, onDismiss)
        return false
    }

    protected open fun shouldMonitorNetwork(): Boolean = false

    protected open fun shouldRequestMobileDataConsent(): Boolean = sessionManager.isLoggedIn()

    protected open fun onNetworkStatusChanged(status: NetworkStatus) = Unit

    protected fun canUseCurrentNetwork(status: NetworkStatus): Boolean {
        return status.isConnected
    }

    protected fun requestMobileDataConsentIfNeeded(
        status: NetworkStatus,
        force: Boolean = false,
        onGranted: (() -> Unit)? = null
    ): Boolean {
        val needsConsent = status.isMobileData && !sessionManager.hasMobileDataConsent()
        if (!force && !needsConsent) {
            return false
        }
        if (!status.isMobileData && !force) {
            return false
        }
        if (mobileDataDialog?.isShowing == true) {
            return true
        }

        val titleView = TextView(this).apply {
            text = "Usar datos moviles"
            setTextColor(ContextCompat.getColor(context, R.color.atelier_action))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(56, 42, 56, 0)
        }

        val dialog = AlertDialog.Builder(this)
            .setCustomTitle(titleView)
            .setMessage(
                "La conexion Wi-Fi ya no esta disponible. ATELIER necesita tu autorizacion para continuar usando datos moviles y mantener catalogos y pujas actualizados."
            )
            .setCancelable(false)
            .setNegativeButton("No permitir") { alertDialog, _ ->
                alertDialog.dismiss()
                sessionManager.setMobileDataConsent(false)
                awaitingMobileConsentAfterWifiLoss = false
                closeApplication()
            }
            .setPositiveButton("Permitir") { alertDialog, _ ->
                alertDialog.dismiss()
                sessionManager.setMobileDataConsent(true)
                awaitingMobileConsentAfterWifiLoss = false
                onGranted?.invoke()
            }
            .create()

        styleDialogButtons(dialog)
        dialog.setOnDismissListener {
            if (mobileDataDialog === dialog) {
                mobileDataDialog = null
            }
        }

        mobileDataDialog = dialog
        dialog.show()
        return true
    }

    override fun onStart() {
        super.onStart()
        if (shouldMonitorNetwork()) {
            networkResource.startMonitoring { status ->
                runOnUiThread {
                    if (!status.isMobileData && mobileDataDialog?.isShowing == true) {
                        mobileDataDialog?.dismiss()
                    }
                    if (status.isWifi) {
                        val now = SystemClock.elapsedRealtime()
                        if (wifiStableSinceMs == null) {
                            wifiStableSinceMs = now
                        }
                        if (!hasQualifiedWifiSession) {
                            val stableForMs = now - (wifiStableSinceMs ?: now)
                            if (stableForMs >= WIFI_SESSION_QUALIFY_MS) {
                                hasQualifiedWifiSession = true
                            }
                        }
                        sessionManager.setMobileDataConsent(false)
                        awaitingMobileConsentAfterWifiLoss = false
                        pendingWifiLossConfirmation = false
                    } else {
                        wifiStableSinceMs = null
                    }

                    if (
                        shouldRequestMobileDataConsent() &&
                        previousNetworkStatus?.isWifi == true &&
                        previousNetworkStatus?.isConnected == true &&
                        !status.isWifi &&
                        hasQualifiedWifiSession
                    ) {
                        pendingWifiLossConfirmation = true
                    }

                    if (
                        pendingWifiLossConfirmation &&
                        !status.isConnected &&
                        !status.isWifi
                    ) {
                        awaitingMobileConsentAfterWifiLoss = true
                        pendingWifiLossConfirmation = false
                    }

                    if (
                        shouldRequestMobileDataConsent() &&
                        status.isMobileData &&
                        status.isConnected &&
                        awaitingMobileConsentAfterWifiLoss
                    ) {
                        requestMobileDataConsentIfNeeded(status, force = true)
                    }

                    if (!status.isConnected && !status.isWifi && !status.isMobileData) {
                        sessionManager.setMobileDataConsent(false)
                    }

                    previousNetworkStatus = status
                    onNetworkStatusChanged(status)
                }
            }
        }
    }

    override fun onStop() {
        if (shouldMonitorNetwork()) {
            networkResource.stopMonitoring()
        }
        mobileDataDialog?.dismiss()
        previousNetworkStatus = null
        awaitingMobileConsentAfterWifiLoss = false
        wifiStableSinceMs = null
        hasQualifiedWifiSession = false
        pendingWifiLossConfirmation = false
        super.onStop()
    }

    protected fun styleDialogButtons(dialog: AlertDialog) {
        dialog.setOnShowListener {
            val color = ContextCompat.getColor(this, R.color.atelier_action)
            dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.setTextColor(color)
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE)?.setTextColor(color)
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL)?.setTextColor(color)
        }
    }

    protected fun restartToLogin() {
        sessionManager.clear()
        startActivity(
            Intent(this, LoginActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        finish()
    }

    protected fun closeApplication() {
        finishAffinity()
        finishAndRemoveTask()
    }

    private fun isSessionInvalid(throwable: Throwable): Boolean {
        val apiException = throwable as? ApiException ?: return false
        if (apiException.statusCode == 401) {
            return true
        }

        val message = apiException.message.orEmpty()
        return message.contains("token invalido", ignoreCase = true) ||
            message.contains("falta token de acceso", ignoreCase = true)
    }

    private companion object {
        const val WIFI_SESSION_QUALIFY_MS = 5_000L
    }
}

