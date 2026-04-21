package com.anonymous.sistemadesubastas.nativeapp.ui.splash

import android.content.Intent
import android.os.Bundle
import android.view.MotionEvent
import com.anonymous.sistemadesubastas.databinding.ActivitySplashBinding
import com.anonymous.sistemadesubastas.nativeapp.ui.auth.LoginActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import kotlin.math.abs

class SplashActivity : BaseActivity() {
    private lateinit var binding: ActivitySplashBinding
    private var startX = 0f
    private var startY = 0f
    private var hasNavigated = false
    private val autoAdvance = Runnable { openNextScreen() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.enterHotspot.setOnClickListener {
            openNextScreen()
        }

        binding.rootSplash.postDelayed(autoAdvance, 1_000L)

        binding.rootSplash.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = event.x
                    startY = event.y
                    false
                }

                MotionEvent.ACTION_UP -> {
                    val deltaY = startY - event.y
                    val deltaX = abs(startX - event.x)
                    if (deltaY > 140f && deltaY > deltaX) {
                        openNextScreen()
                        true
                    } else {
                        false
                    }
                }

                else -> false
            }
        }
    }

    override fun onDestroy() {
        binding.rootSplash.removeCallbacks(autoAdvance)
        super.onDestroy()
    }

    private fun openNextScreen() {
        if (hasNavigated) {
            return
        }
        hasNavigated = true
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }
}
