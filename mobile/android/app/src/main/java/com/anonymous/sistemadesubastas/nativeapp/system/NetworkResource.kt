package com.anonymous.sistemadesubastas.nativeapp.system

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities

data class NetworkStatus(
    val isConnected: Boolean,
    val isWifi: Boolean,
    val isMobileData: Boolean
) {
    companion object {
        fun disconnected(): NetworkStatus = NetworkStatus(
            isConnected = false,
            isWifi = false,
            isMobileData = false
        )
    }
}

class NetworkResource(
    private val systemServices: SystemServiceProvider
) {
    private val connectivityManager: ConnectivityManager
        get() = systemServices.connectivityManager()

    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    fun currentStatus(): NetworkStatus {
        val capabilities = connectivityManager
            .getNetworkCapabilities(connectivityManager.activeNetwork)
            ?: return NetworkStatus.disconnected()

        val connected = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)

        return NetworkStatus(
            isConnected = connected,
            isWifi = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI),
            isMobileData = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
        )
    }

    fun startMonitoring(onChanged: (NetworkStatus) -> Unit) {
        if (networkCallback != null) {
            onChanged(currentStatus())
            return
        }

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                onChanged(currentStatus())
            }

            override fun onLost(network: Network) {
                onChanged(currentStatus())
            }

            override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
                onChanged(currentStatus())
            }

            override fun onUnavailable() {
                onChanged(NetworkStatus.disconnected())
            }
        }

        networkCallback = callback
        connectivityManager.registerDefaultNetworkCallback(callback)
        onChanged(currentStatus())
    }

    fun stopMonitoring() {
        networkCallback?.let { callback ->
            connectivityManager.unregisterNetworkCallback(callback)
        }
        networkCallback = null
    }
}
