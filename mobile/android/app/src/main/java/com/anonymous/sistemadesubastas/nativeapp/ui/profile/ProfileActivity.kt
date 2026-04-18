package com.anonymous.sistemadesubastas.nativeapp.ui.profile

import android.content.Intent
import android.os.Bundle
import android.view.View
import com.anonymous.sistemadesubastas.databinding.ActivityProfileBinding
import com.anonymous.sistemadesubastas.databinding.ItemPaymentMethodBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.ActiveAuction
import com.anonymous.sistemadesubastas.nativeapp.data.model.Metrics
import com.anonymous.sistemadesubastas.nativeapp.data.model.PaymentMethod
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuctionRepository
import com.anonymous.sistemadesubastas.nativeapp.data.repository.ProfileRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.auctions.AuctionRoomActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.Formatters
import com.anonymous.sistemadesubastas.nativeapp.ui.common.RemoteImageLoader
import com.anonymous.sistemadesubastas.nativeapp.ui.home.HomeActivity

class ProfileActivity : BaseActivity() {
    private lateinit var binding: ActivityProfileBinding
    private val profileRepository by lazy { ProfileRepository(apiClient) }
    private val auctionRepository by lazy { AuctionRepository(apiClient) }
    private var activeAuction: ActiveAuction? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }

        binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.backButton.setOnClickListener {
            startActivity(Intent(this, HomeActivity::class.java))
            finish()
        }
        binding.logoutButton.setOnClickListener {
            sessionManager.clear()
            restartToLogin()
        }
        binding.continueAuctionButton.setOnClickListener {
            activeAuction?.let { auction ->
                startActivity(
                    Intent(this, AuctionRoomActivity::class.java)
                        .putExtra(AuctionRoomActivity.EXTRA_AUCTION_ID, auction.auctionId)
                )
            }
        }

        sessionManager.userSnapshot()?.let { renderProfile(it) }
        loadProfile()
    }

    private fun loadProfile() {
        AppExecutors.ioThenMain(
            task = {
                val profile = profileRepository.profile()
                val metrics = profileRepository.metrics()
                val paymentMethods = profileRepository.paymentMethods()
                val activeAuction = auctionRepository.activeAuction()
                ProfilePayload(profile, metrics, paymentMethods, activeAuction)
            },
            onSuccess = { payload ->
                persistSessionUser(payload.profile)
                activeAuction = payload.activeAuction
                renderProfile(payload.profile)
                renderMetrics(payload.metrics)
                renderPaymentMethods(payload.paymentMethods)
                renderActiveAuction(payload.activeAuction)
            },
            onError = { throwable ->
                alert("No se pudo cargar el perfil", throwable.message ?: "Intenta de nuevo.")
            }
        )
    }

    private fun renderProfile(profile: UserProfile) {
        binding.fullNameText.text = profile.fullName
        binding.categoryText.text = Formatters.categoryUpper(profile.category)
        binding.emailText.text = profile.email
        binding.addressText.text = profile.legalAddress.ifBlank { "Sin direccion registrada." }
        RemoteImageLoader.load(binding.profileAvatar, profile.avatarImageUrl)
    }

    private fun renderMetrics(metrics: Metrics) {
        binding.joinedValue.text = metrics.auctionsJoined.toString()
        binding.wonValue.text = metrics.auctionsWon.toString()
        binding.activeBidsValue.text = metrics.activeBids.toString()
    }

    private fun renderPaymentMethods(paymentMethods: List<PaymentMethod>) {
        binding.paymentMethodsContainer.removeAllViews()
        binding.paymentEmptyText.visibility = if (paymentMethods.isEmpty()) View.VISIBLE else View.GONE

        paymentMethods.forEach { paymentMethod ->
            val itemBinding = ItemPaymentMethodBinding.inflate(layoutInflater, binding.paymentMethodsContainer, false)
            itemBinding.paymentTitle.text = paymentMethod.displayName
            itemBinding.paymentSubtitle.text = listOfNotNull(
                paymentMethod.currency,
                paymentMethod.issuingBank,
                paymentMethod.lastFour?.let { "****$it" }
            ).joinToString(" - ")
            itemBinding.paymentStatus.text = paymentMethod.status
            binding.paymentMethodsContainer.addView(itemBinding.root)
        }
    }

    private fun renderActiveAuction(activeAuction: ActiveAuction?) {
        if (activeAuction == null) {
            binding.activeAuctionCard.visibility = View.GONE
            return
        }

        binding.activeAuctionCard.visibility = View.VISIBLE
        binding.activeAuctionTitle.text = activeAuction.title
        binding.activeAuctionMeta.text = listOfNotNull(
            Formatters.category(activeAuction.category),
            activeAuction.currentLotTitle,
            activeAuction.currentPrice?.let { Formatters.money(activeAuction.currency, it) }
        ).joinToString(" - ")
    }

    private data class ProfilePayload(
        val profile: UserProfile,
        val metrics: Metrics,
        val paymentMethods: List<PaymentMethod>,
        val activeAuction: ActiveAuction?
    )
}
