package com.anonymous.sistemadesubastas.nativeapp.ui.splash

import android.content.Intent
import android.os.Bundle
import android.view.MotionEvent
import com.anonymous.sistemadesubastas.databinding.ActivitySplashBinding
import com.anonymous.sistemadesubastas.nativeapp.ui.auth.LoginActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.home.HomeActivity
import kotlin.math.abs

class SplashActivity : BaseActivity() {
    private lateinit var binding: ActivitySplashBinding
    private var startX = 0f
    private var startY = 0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.enterHotspot.setOnClickListener {
            openNextScreen()
        }

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

    private fun openNextScreen() {
        val target = if (sessionManager.isLoggedIn()) {
            HomeActivity::class.java
        } else {
            LoginActivity::class.java
        }
        startActivity(Intent(this, target))
        finish()
    }
}
