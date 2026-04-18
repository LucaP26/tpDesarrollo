package com.anonymous.sistemadesubastas.nativeapp.ui.common

import android.content.Intent
import androidx.appcompat.app.AlertDialog
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile
import com.anonymous.sistemadesubastas.nativeapp.data.network.ApiClient
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

    protected fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    protected fun alert(title: String, message: String, onDismiss: (() -> Unit)? = null) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Entendido") { dialog, _ ->
                dialog.dismiss()
                onDismiss?.invoke()
            }
            .show()
    }

    protected fun persistSessionUser(user: UserProfile) {
        sessionManager.token()?.let { token ->
            sessionManager.saveSession(token, user)
        }
    }

    protected open fun shouldMonitorNetwork(): Boolean = false

    protected open fun onNetworkStatusChanged(status: NetworkStatus) = Unit

    override fun onStart() {
        super.onStart()
        if (shouldMonitorNetwork()) {
            networkResource.startMonitoring { status ->
                runOnUiThread { onNetworkStatusChanged(status) }
            }
        }
    }

    override fun onStop() {
        if (shouldMonitorNetwork()) {
            networkResource.stopMonitoring()
        }
        super.onStop()
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
}
