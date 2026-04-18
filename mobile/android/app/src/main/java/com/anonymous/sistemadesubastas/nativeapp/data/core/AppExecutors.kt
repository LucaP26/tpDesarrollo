package com.anonymous.sistemadesubastas.nativeapp.data.core

import android.os.Handler
import android.os.Looper
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

object AppExecutors {
    private val ioExecutor: ExecutorService = Executors.newFixedThreadPool(4)
    private val mainHandler = Handler(Looper.getMainLooper())

    private fun runOnIo(task: () -> Unit) {
        ioExecutor.execute(task)
    }

    private fun runOnMain(task: () -> Unit) {
        mainHandler.post(task)
    }

    fun <T> ioThenMain(
        task: () -> T,
        onSuccess: (T) -> Unit,
        onError: (Throwable) -> Unit
    ) {
        runOnIo {
            try {
                val result = task()
                runOnMain { onSuccess(result) }
            } catch (throwable: Throwable) {
                runOnMain { onError(throwable) }
            }
        }
    }
}
