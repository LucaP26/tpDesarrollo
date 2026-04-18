package com.anonymous.sistemadesubastas.nativeapp.ui.home

import android.content.Intent
import android.os.Bundle
import com.anonymous.sistemadesubastas.databinding.ActivityHomeBinding
import com.anonymous.sistemadesubastas.databinding.ItemDepartmentChipBinding
import com.anonymous.sistemadesubastas.databinding.ItemHomeClosingCardBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.AuctionSummary
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuctionRepository
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuthRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.auctions.AuctionRoomActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.auctions.AuctionsActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.Formatters
import com.anonymous.sistemadesubastas.nativeapp.ui.common.RemoteImageLoader
import com.anonymous.sistemadesubastas.nativeapp.ui.profile.ProfileActivity

class HomeActivity : BaseActivity() {
    private lateinit var binding: ActivityHomeBinding
    private val authRepository by lazy { AuthRepository(apiClient) }
    private val auctionRepository by lazy { AuctionRepository(apiClient) }
    private var featuredAuction: AuctionSummary? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }

        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.profileButton.setOnClickListener { openProfile() }
        binding.profileButtonLarge.setOnClickListener { openProfile() }
        binding.catalogButton.setOnClickListener { openAuctions() }
        binding.auctionsButton.setOnClickListener { openAuctions() }
        binding.viewAllButton.setOnClickListener { openAuctions() }
        binding.heroCard.setOnClickListener {
            featuredAuction?.let(::joinAndOpenAuction)
        }

        sessionManager.userSnapshot()?.let { renderProfile(it) }
        loadScreen()
    }

    private fun loadScreen() {
        AppExecutors.ioThenMain(
            task = {
                val profile = authRepository.profile()
                val auctions = auctionRepository.listAuctions()
                HomePayload(profile, auctions)
            },
            onSuccess = { payload ->
                persistSessionUser(payload.profile)
                renderProfile(payload.profile)
                renderAuctions(payload.auctions)
            },
            onError = { throwable ->
                alert("No pudimos cargar inicio", throwable.message ?: "Intenta de nuevo.")
            }
        )
    }

    private fun renderProfile(profile: UserProfile) {
        binding.categoryText.text = Formatters.category(profile.category)
        RemoteImageLoader.load(binding.profileAvatar, profile.avatarImageUrl)
    }

    private fun renderAuctions(auctions: List<AuctionSummary>) {
        binding.departmentsRow.removeAllViews()
        binding.closingSoonRow.removeAllViews()

        if (auctions.isEmpty()) {
            binding.heroTitle.text = "Sin catalogos publicados"
            binding.heroSubtitle.text = "Todavia no hay salas disponibles en el backend."
            binding.heroPrice.text = "-"
            binding.heroAccess.text = "Sin acceso"
            binding.catalogCopy.text = "Cuando se publique una sala, la veras aqui."
            featuredAuction = null
            return
        }

        featuredAuction = auctions.firstOrNull { it.canViewCatalog } ?: auctions.first()
        val featured = featuredAuction ?: return

        binding.heroTitle.text = featured.previewLotTitle ?: featured.title
        binding.heroSubtitle.text = Formatters.auctionMeta(featured.location, featured.scheduledAt, featured.auctioneerName)
        binding.heroPrice.text = Formatters.money(featured.currency, featured.bestOffer ?: featured.previewBasePrice)
        binding.heroAccess.text = buildAccessText(featured)
        binding.catalogCopy.text = "Explora salas curadas por categoria y entra a la que estes habilitada para ver."
        RemoteImageLoader.load(binding.heroImage, featured.previewImageUrl)

        auctions
            .map { it.category }
            .distinct()
            .sortedBy(::categoryRank)
            .forEach { category ->
                val chipBinding = ItemDepartmentChipBinding.inflate(layoutInflater, binding.departmentsRow, false)
                chipBinding.departmentLabel.text = Formatters.categoryUpper(category)
                chipBinding.root.setOnClickListener {
                    openAuctions(category)
                }
                binding.departmentsRow.addView(chipBinding.root)
            }

        auctions.take(5).forEach { auction ->
            binding.closingSoonRow.addView(createClosingCard(auction))
        }
    }

    private fun createClosingCard(auction: AuctionSummary) =
        ItemHomeClosingCardBinding.inflate(layoutInflater, binding.closingSoonRow, false).apply {
            categoryText.text = Formatters.categoryUpper(auction.category)
            titleText.text = auction.title
            priceText.text = Formatters.money(auction.currency, auction.bestOffer ?: auction.previewBasePrice)
            RemoteImageLoader.load(auctionImage, auction.previewImageUrl)
            root.setOnClickListener { joinAndOpenAuction(auction) }
        }.root

    private fun joinAndOpenAuction(auction: AuctionSummary) {
        if (!auction.canViewCatalog) {
            alert(
                "Catalogo restringido",
                auction.viewBlockReason ?: "Esta sala requiere una categoria superior."
            )
            return
        }

        AppExecutors.ioThenMain(
            task = { auctionRepository.join(auction.id) },
            onSuccess = { result ->
                if (result.connected) {
                    startActivity(
                        Intent(this, AuctionRoomActivity::class.java)
                            .putExtra(AuctionRoomActivity.EXTRA_AUCTION_ID, auction.id)
                    )
                } else {
                    alert("No se pudo ingresar", result.blockReason ?: "No fue posible unirse a la sala.")
                }
            },
            onError = { throwable ->
                alert("No se pudo ingresar", throwable.message ?: "Intenta de nuevo en unos instantes.")
            }
        )
    }

    private fun openAuctions(filter: String? = null) {
        startActivity(
            Intent(this, AuctionsActivity::class.java)
                .putExtra(AuctionsActivity.EXTRA_FILTER, filter)
        )
    }

    private fun openProfile() {
        startActivity(Intent(this, ProfileActivity::class.java))
    }

    private fun buildAccessText(auction: AuctionSummary): String = when {
        auction.canBid -> "Puja habilitada"
        auction.canViewCatalog -> "Solo catalogo"
        else -> "Requiere ${Formatters.category(auction.category)}"
    }

    private fun categoryRank(category: String): Int = when (category.lowercase()) {
        "comun" -> 0
        "especial" -> 1
        "plata" -> 2
        "oro" -> 3
        "platino" -> 4
        else -> 99
    }

    private data class HomePayload(
        val profile: UserProfile,
        val auctions: List<AuctionSummary>
    )
}
