package com.anonymous.sistemadesubastas.nativeapp.ui.common

import android.graphics.BitmapFactory
import android.util.Base64
import android.widget.ImageView
import com.anonymous.sistemadesubastas.R
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import java.net.URL

object RemoteImageLoader {
    fun load(imageView: ImageView, url: String?) {
        if (url.isNullOrBlank()) {
            imageView.setImageDrawable(null)
            return
        }
        if (url.startsWith("drawable://", ignoreCase = true)) {
            loadDrawableResource(imageView, url)
            return
        }
        AppExecutors.ioThenMain(
            task = {
                decodeBitmap(url)
            },
            onSuccess = { bitmap ->
                if (bitmap != null) {
                    imageView.setImageBitmap(bitmap)
                }
            },
            onError = {
                // Keep current placeholder on failure.
            }
        )
    }

    private fun decodeBitmap(source: String) = when {
        source.startsWith("data:image", ignoreCase = true) -> decodeDataUrl(source)
        else -> URL(source).openStream().use { BitmapFactory.decodeStream(it) }
    }

    private fun loadDrawableResource(imageView: ImageView, source: String) {
        val resourceName = source.substringAfter("drawable://").trim()
        val resourceId = imageView.resources.getIdentifier(
            resourceName,
            "drawable",
            imageView.context.packageName
        )
        if (resourceId != 0) {
            imageView.setImageResource(resourceId)
        } else {
            imageView.setImageResource(R.drawable.bg_card_surface)
        }
    }

    private fun decodeDataUrl(source: String) = source
        .substringAfter("base64,", missingDelimiterValue = "")
        .takeIf { it.isNotBlank() }
        ?.let { encoded ->
            val bytes = Base64.decode(encoded, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        }
}
