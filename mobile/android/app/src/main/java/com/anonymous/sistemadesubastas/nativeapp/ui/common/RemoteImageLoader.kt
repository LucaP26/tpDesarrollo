package com.anonymous.sistemadesubastas.nativeapp.ui.common

import android.graphics.BitmapFactory
import android.widget.ImageView
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import java.net.URL

object RemoteImageLoader {
    fun load(imageView: ImageView, url: String?) {
        if (url.isNullOrBlank()) {
            imageView.setImageDrawable(null)
            return
        }
        AppExecutors.ioThenMain(
            task = {
                URL(url).openStream().use { BitmapFactory.decodeStream(it) }
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
}
