package com.anonymous.sistemadesubastas.nativeapp.ui.common

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Currency
import java.util.Date
import java.util.Locale

object Formatters {
    fun money(currencyCode: String, amount: Double?): String {
        val value = amount?.takeIf { it.isFinite() } ?: 0.0
        val formatter = NumberFormat.getCurrencyInstance(Locale("es", "AR"))
        formatter.maximumFractionDigits = 0
        formatter.currency = Currency.getInstance(currencyCode)
        return formatter.format(value)
    }

    fun date(value: String): String {
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            val date = parser.parse(value) ?: Date()
            SimpleDateFormat("d MMM", Locale("es", "AR")).format(date)
        } catch (_: Throwable) {
            value
        }
    }

    fun category(category: String): String = when (category.lowercase(Locale.getDefault())) {
        "platino" -> "Platino"
        "oro" -> "Oro"
        "plata" -> "Plata"
        "especial" -> "Especial"
        else -> "Comun"
    }

    fun categoryUpper(category: String): String = category(category).uppercase(Locale("es", "AR"))

    fun auctionMeta(location: String, scheduledAt: String, auctioneerName: String): String {
        val parts = listOf(location, date(scheduledAt), auctioneerName).filter { it.isNotBlank() }
        return parts.joinToString(" - ")
    }

    fun consignmentStatus(status: String): String = when (status.lowercase(Locale.getDefault())) {
        "borrador" -> "Borrador"
        "enviada" -> "Enviada"
        "en_revision" -> "En revision"
        "pendiente_confirmacion" -> "Pendiente de confirmacion"
        "aceptada" -> "Aceptada"
        "rechazada" -> "Rechazada"
        "devuelta" -> "Devuelta"
        else -> "Enviada"
    }
}
