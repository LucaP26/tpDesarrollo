package com.anonymous.sistemadesubastas.nativeapp.ui.auctions

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.anonymous.sistemadesubastas.databinding.ActivityAuctionsBinding
import com.anonymous.sistemadesubastas.databinding.ItemAuctionCardBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.AuctionSummary
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuctionRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
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

        binding.backButton.setOnClickListener { finish() }
        binding.clearButton.setOnClickListener { binding.searchInput.setText("") }
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

    private fun loadAuctions() {
        AppExecutors.ioThenMain(
            task = { auctionRepository.listAuctions() },
            onSuccess = { auctions ->
                allAuctions = auctions
                renderAuctions(filterAuctions(binding.searchInput.text?.toString().orEmpty()))
            },
            onError = { throwable ->
                alert("No pudimos cargar subastas", throwable.message ?: "Intenta de nuevo.")
            }
        )
    }

    private fun filterAuctions(query: String): List<AuctionSummary> {
        val normalized = query.trim().lowercase()
        if (normalized.isBlank()) {
            return allAuctions
        }
        return allAuctions.filter { summary ->
            summary.title.lowercase().contains(normalized) ||
                summary.category.lowercase().contains(normalized) ||
                summary.previewLotTitle.orEmpty().lowercase().contains(normalized) ||
                summary.auctioneerName.lowercase().contains(normalized)
        }
    }

    private fun renderAuctions(auctions: List<AuctionSummary>) {
        binding.auctionsContainer.removeAllViews()

        if (auctions.isEmpty()) {
            val empty = TextView(this).apply {
                text = "No hay salas para ese filtro todavia."
                setTextColor(ContextCompat.getColor(context, com.anonymous.sistemadesubastas.R.color.curator_text))
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
                "Sala con ${auction.totalLots} lotes. Se exhibe un lote por vez y la subasta avanza cuando se adjudica."
            } else {
                auction.viewBlockReason ?: "Catalogo restringido para tu categoria."
            }
            priceText.text = Formatters.money(auction.currency, auction.bestOffer ?: auction.previewBasePrice)
            actionButton.text = if (auction.canViewCatalog) {
                "Ver catalogo"
            } else {
                "Categoria ${Formatters.category(auction.category)}"
            }
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
            joinAndOpen(auction)
        }
    }

    private fun joinAndOpen(auction: AuctionSummary) {
        AppExecutors.ioThenMain(
            task = { auctionRepository.join(auction.id) },
            onSuccess = { result ->
                if (result.connected) {
                    startActivity(
                        Intent(this, AuctionRoomActivity::class.java)
                            .putExtra(AuctionRoomActivity.EXTRA_AUCTION_ID, auction.id)
                    )
                } else {
                    alert("No se pudo ingresar", result.blockReason ?: "No fue posible entrar a la sala.")
                }
            },
            onError = { throwable ->
                alert("No se pudo ingresar", throwable.message ?: "Intenta de nuevo en unos instantes.")
            }
        )
    }

    companion object {
        const val EXTRA_FILTER = "extra_filter"
    }
}
