package com.anonymous.sistemadesubastas.nativeapp.system

import android.content.Context
import android.net.ConnectivityManager

class SystemServiceProvider(private val context: Context) {
    fun connectivityManager(): ConnectivityManager =
        context.getSystemService(ConnectivityManager::class.java)
            ?: error("No se pudo obtener ConnectivityManager.")
}
