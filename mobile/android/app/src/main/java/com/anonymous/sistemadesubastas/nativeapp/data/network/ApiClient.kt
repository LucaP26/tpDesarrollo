package com.anonymous.sistemadesubastas.nativeapp.data.network

import com.anonymous.sistemadesubastas.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class ApiClient(private val tokenProvider: () -> String?) {

    fun get(path: String, authenticated: Boolean = true): JSONObject {
        return execute(path = path, method = "GET", body = null, authenticated = authenticated)
    }

    fun getNullable(path: String, authenticated: Boolean = true): JSONObject? {
        return executeNullable(path = path, method = "GET", body = null, authenticated = authenticated)
    }

    fun getArray(path: String, authenticated: Boolean = true): JSONArray {
        return executeArray(path = path, method = "GET", body = null, authenticated = authenticated)
    }

    fun post(path: String, body: JSONObject?, authenticated: Boolean = true): JSONObject {
        return execute(path = path, method = "POST", body = body, authenticated = authenticated)
    }

    private fun execute(path: String, method: String, body: JSONObject?, authenticated: Boolean): JSONObject {
        return executeNullable(path, method, body, authenticated) ?: JSONObject()
    }

    private fun executeNullable(path: String, method: String, body: JSONObject?, authenticated: Boolean): JSONObject? {
        val connection = openConnection(path, method, authenticated)
        writeBody(connection, body)
        val (code, payload) = readResponse(connection)

        if (code !in 200..299) {
            val json = if (payload.isNotBlank() && payload != "null") JSONObject(payload) else JSONObject()
            throw ApiException(json.optString("detail").ifBlank { "Error inesperado" })
        }
        if (payload.isBlank() || payload == "null") {
            return null
        }
        return JSONObject(payload)
    }

    private fun executeArray(path: String, method: String, body: JSONObject?, authenticated: Boolean): JSONArray {
        val connection = openConnection(path, method, authenticated)
        writeBody(connection, body)
        val (code, payload) = readResponse(connection)

        if (code !in 200..299) {
            val errorJson = if (payload.isNotBlank()) JSONObject(payload) else JSONObject()
            throw ApiException(errorJson.optString("detail").ifBlank { "Error inesperado" })
        }

        return if (payload.isNotBlank()) JSONArray(payload) else JSONArray()
    }

    private fun openConnection(path: String, method: String, authenticated: Boolean): HttpURLConnection {
        val connection = URL("${BuildConfig.API_BASE_URL}$path").openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 12_000
        connection.readTimeout = 12_000
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Accept", "application/json")

        if (authenticated) {
            val token = tokenProvider()
            if (token.isNullOrBlank()) {
                throw ApiException("Falta token de acceso.")
            }
            connection.setRequestProperty("Authorization", "Bearer $token")
        }
        return connection
    }

    private fun writeBody(connection: HttpURLConnection, body: JSONObject?) {
        if (body != null) {
            connection.doOutput = true
            connection.outputStream.bufferedWriter().use { writer ->
                writer.write(body.toString())
            }
        }
    }

    private fun readResponse(connection: HttpURLConnection): Pair<Int, String> {
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val payload = stream?.let { input ->
            BufferedReader(InputStreamReader(input)).use { it.readText() }
        }.orEmpty()
        return code to payload
    }
}

class ApiException(message: String) : RuntimeException(message)
