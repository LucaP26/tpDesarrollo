package com.anonymous.sistemadesubastas.nativeapp.ui.auctions

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.anonymous.sistemadesubastas.databinding.ActivityAuctionsBinding
import com.anonymous.sistemadesubastas.databinding.ItemAuctionCardBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.AuctionSummary
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuctionRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.FooterTab
import com.anonymous.sistemadesubastas.nativeapp.ui.common.Formatters
import com.anonymous.sistemadesubastas.nativeapp.ui.common.RemoteImageLoader

class AuctionsActivity : BaseActivity() {
    private lateinit var binding: ActivityAuctionsBinding
    private val auctionRepository by lazy { AuctionRepository(apiClient) }
    private var allAuctions: List<AuctionSummary> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }

        binding = ActivityAuctionsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        bindFooterNavigation(binding.footerNav, FooterTab.DISCOVER)

        binding.backButton.setOnClickListener { finish() }
        binding.searchInput.addTextChangedListener(
            object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
                override fun afterTextChanged(s: Editable?) {
                    renderAuctions(filterAuctions(s?.toString().orEmpty()))
                }
            }
        )

        val presetFilter = intent.getStringExtra(EXTRA_FILTER).orEmpty()
        if (presetFilter.isNotBlank()) {
            binding.searchInput.setText(presetFilter)
        }

        loadAuctions()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    private fun loadAuctions() {
        AppExecutors.ioThenMain(
            task = { auctionRepository.listAuctions() },
            onSuccess = { auctions ->
                allAuctions = auctions
                renderAuctions(filterAuctions(binding.searchInput.text?.toString().orEmpty()))
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No pudimos cargar subastas",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun filterAuctions(query: String): List<AuctionSummary> {
        val normalized = query.trim().lowercase()
        if (normalized.isBlank()) {
            return allAuctions
        }
        val tokens = searchTokens(normalized)
        return allAuctions.filter { summary ->
            val terms = buildList {
                add(summary.title)
                add(summary.category)
                add(summary.previewLotTitle.orEmpty())
                add(summary.auctioneerName)
                addAll(summary.searchableTerms)
            }.joinToString(" ").lowercase()
            tokens.any { token -> terms.contains(token) }
        }
    }

    private fun searchTokens(query: String): Set<String> {
        val tokens = mutableSetOf(query)
        if (query in setOf("watch", "watches")) {
            tokens += listOf("watch", "watches", "reloj", "relojes", "timepiece", "timepieces")
        }
        return tokens
    }

    private fun renderAuctions(auctions: List<AuctionSummary>) {
        binding.auctionsContainer.removeAllViews()

        if (auctions.isEmpty()) {
            val empty = TextView(this).apply {
                text = "No hay salas para ese filtro todavia."
                setTextColor(ContextCompat.getColor(context, com.anonymous.sistemadesubastas.R.color.atelier_text))
                textSize = 15f
            }
            binding.auctionsContainer.addView(empty)
            return
        }

        auctions.forEach { auction ->
            binding.auctionsContainer.addView(createAuctionCard(auction))
        }
    }

    private fun createAuctionCard(auction: AuctionSummary) =
        ItemAuctionCardBinding.inflate(layoutInflater, binding.auctionsContainer, false).apply {
            categoryText.text = Formatters.categoryUpper(auction.category)
            titleText.text = auction.title
            metaText.text = Formatters.auctionMeta(auction.location, auction.scheduledAt, auction.auctioneerName)
            descriptionText.text = if (auction.canViewCatalog) {
                if (auction.state == STATE_SCHEDULED) {
                    "Sala programada con ${auction.totalLots} lotes. Podes ver el catalogo, pero las pujas se habilitaran al iniciar."
                } else {
                    "Sala con ${auction.totalLots} lotes. Se exhibe un lote por vez y la subasta avanza cuando se adjudica."
                }
            } else {
                auction.viewBlockReason ?: "Catalogo restringido para tu categoria."
            }
            priceText.text = if (auction.priceAvailable) {
                Formatters.money(auction.currency, auction.bestOffer ?: auction.previewBasePrice)
            } else {
                "Precio disponible al iniciar"
            }
            actionButton.text = "Entrar"
            wishlistButton.visibility = View.VISIBLE
            wishlistButton.alpha = if (auction.state == STATE_SCHEDULED && auction.canViewCatalog) 1f else 0.45f
            wishlistButton.text = if (auction.inWatchlist) "♥" else "♡"
            wishlistButton.contentDescription = if (auction.inWatchlist) {
                "Quitar de Watchlist"
            } else {
                "Agregar a Watchlist"
            }
            wishlistButton.setOnClickListener { toggleWatchlist(auction) }
            RemoteImageLoader.load(auctionImage, auction.previewImageUrl)

            val openAction = { openAuctionCard(auction) }
            root.setOnClickListener { openAction() }
            actionButton.setOnClickListener { openAction() }
        }.root

    private fun openAuctionCard(auction: AuctionSummary) {
        if (!auction.canViewCatalog) {
            alert(
                "Catalogo restringido",
                auction.viewBlockReason ?: "Tu categoria todavia no puede ver esta sala."
            )
        } else {
            if (auction.state == STATE_SCHEDULED) {
                openAuctionRoom(auction)
            } else {
                joinAndOpen(auction)
            }
        }
    }

    private fun joinAndOpen(auction: AuctionSummary) {
        AppExecutors.ioThenMain(
            task = { auctionRepository.join(auction.id) },
            onSuccess = { result ->
                if (result.connected) {
                    openAuctionRoom(auction)
                } else {
                    alert("No se pudo ingresar", result.blockReason ?: "No fue posible entrar a la sala.")
                }
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No se pudo ingresar",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo en unos instantes."
                )
            }
        )
    }

    private fun toggleWatchlist(auction: AuctionSummary) {
        if (!auction.canViewCatalog) {
            alert(
                "Catalogo restringido",
                auction.viewBlockReason ?: "Tu categoria todavia no puede ver esta sala."
            )
            return
        }
        if (auction.state != STATE_SCHEDULED) {
            alert(
                "Watchlist no disponible",
                "Solo podes guardar subastas programadas en tu Watchlist."
            )
            return
        }

        AppExecutors.ioThenMain(
            task = {
                if (auction.inWatchlist) {
                    auctionRepository.removeFromWatchlist(auction.id)
                    false
                } else {
                    auctionRepository.addToWatchlist(auction.id)
                    true
                }
            },
            onSuccess = { isSaved ->
                allAuctions = allAuctions.map { item ->
                    if (item.id == auction.id) item.copy(inWatchlist = isSaved) else item
                }
                toast(if (isSaved) "Agregada a Watchlist" else "Eliminada de Watchlist")
                renderAuctions(filterAuctions(binding.searchInput.text?.toString().orEmpty()))
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

    private fun openAuctionRoom(auction: AuctionSummary) {
        startActivity(
            Intent(this, AuctionRoomActivity::class.java)
                .putExtra(AuctionRoomActivity.EXTRA_AUCTION_ID, auction.id)
        )
    }

    companion object {
        const val EXTRA_FILTER = "extra_filter"
        private const val STATE_SCHEDULED = "programada"
    }
}

