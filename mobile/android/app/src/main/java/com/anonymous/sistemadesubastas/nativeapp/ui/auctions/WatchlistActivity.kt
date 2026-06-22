package com.anonymous.sistemadesubastas.nativeapp.ui.auctions

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.anonymous.sistemadesubastas.databinding.ActivityWatchlistBinding
import com.anonymous.sistemadesubastas.databinding.ItemAuctionCardBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.AuctionSummary
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuctionRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.FooterTab
import com.anonymous.sistemadesubastas.nativeapp.ui.common.Formatters
import com.anonymous.sistemadesubastas.nativeapp.ui.common.RemoteImageLoader

class WatchlistActivity : BaseActivity() {
    private lateinit var binding: ActivityWatchlistBinding
    private val auctionRepository by lazy { AuctionRepository(apiClient) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }

        binding = ActivityWatchlistBinding.inflate(layoutInflater)
        setContentView(binding.root)
        bindFooterNavigation(binding.footerNav, FooterTab.WATCHLIST)
        binding.backButton.setOnClickListener { finish() }
        loadWatchlist()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    private fun loadWatchlist() {
        AppExecutors.ioThenMain(
            task = { auctionRepository.watchlist() },
            onSuccess = { auctions -> renderWatchlist(auctions) },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No pudimos cargar Watchlist",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun renderWatchlist(auctions: List<AuctionSummary>) {
        binding.watchlistContainer.removeAllViews()
        if (auctions.isEmpty()) {
            val empty = TextView(this).apply {
                text = "Todavia no guardaste subastas programadas."
                setTextColor(ContextCompat.getColor(context, com.anonymous.sistemadesubastas.R.color.atelier_text))
                textSize = 15f
            }
            binding.watchlistContainer.addView(empty)
            return
        }

        auctions.forEach { auction ->
            binding.watchlistContainer.addView(createWatchlistCard(auction))
        }
    }

    private fun createWatchlistCard(auction: AuctionSummary) =
        ItemAuctionCardBinding.inflate(layoutInflater, binding.watchlistContainer, false).apply {
            categoryText.text = Formatters.categoryUpper(auction.category)
            titleText.text = auction.title
            metaText.text = Formatters.auctionMeta(auction.location, auction.scheduledAt, auction.auctioneerName)
            descriptionText.text = "Sala programada con ${auction.totalLots} lotes. Las pujas se habilitaran al iniciar."
            priceText.text = "Precio disponible al iniciar"
            actionButton.text = "Entrar"
            wishlistButton.visibility = View.VISIBLE
            wishlistButton.alpha = 1f
            wishlistButton.text = "♥"
            wishlistButton.contentDescription = "Quitar de Watchlist"
            wishlistButton.setOnClickListener { removeFromWatchlist(auction) }
            RemoteImageLoader.load(auctionImage, auction.previewImageUrl)

            val openAction = { openAuction(auction) }
            root.setOnClickListener { openAction() }
            actionButton.setOnClickListener { openAction() }
        }.root

    private fun openAuction(auction: AuctionSummary) {
        if (!auction.canViewCatalog) {
            alert(
                "Catalogo restringido",
                auction.viewBlockReason ?: "Tu categoria todavia no puede ver esta sala."
            )
            return
        }
        startActivity(
            Intent(this, AuctionRoomActivity::class.java)
                .putExtra(AuctionRoomActivity.EXTRA_AUCTION_ID, auction.id)
        )
    }

    private fun removeFromWatchlist(auction: AuctionSummary) {
        AppExecutors.ioThenMain(
            task = { auctionRepository.removeFromWatchlist(auction.id) },
            onSuccess = {
                toast("Eliminada de Watchlist")
                loadWatchlist()
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No se pudo actualizar Watchlist",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }
}
