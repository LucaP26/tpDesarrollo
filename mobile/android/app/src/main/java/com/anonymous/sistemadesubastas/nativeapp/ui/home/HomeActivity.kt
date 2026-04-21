package com.anonymous.sistemadesubastas.nativeapp.ui.home

import android.content.Intent
import android.os.Bundle
import com.anonymous.sistemadesubastas.databinding.ActivityHomeBinding
import com.anonymous.sistemadesubastas.databinding.ItemDepartmentChipBinding
import com.anonymous.sistemadesubastas.databinding.ItemFeaturedCollectionCardBinding
import com.anonymous.sistemadesubastas.databinding.ItemHomeClosingCardBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.ActiveAuction
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuctionRepository
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuthRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.auctions.AuctionRoomActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.auctions.AuctionsActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.RemoteImageLoader
import com.anonymous.sistemadesubastas.nativeapp.ui.profile.ProfileActivity

class HomeActivity : BaseActivity() {
    private lateinit var binding: ActivityHomeBinding
    private val authRepository by lazy { AuthRepository(apiClient) }
    private val auctionRepository by lazy { AuctionRepository(apiClient) }
    private var activeAuction: ActiveAuction? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }

        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)

        bindStaticContent()
        bindActions()

        sessionManager.userSnapshot()?.let(::renderProfile)
        loadScreen()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    private fun bindStaticContent() {
        RemoteImageLoader.load(binding.heroImage, HERO_IMAGE_URL)
        RemoteImageLoader.load(binding.editorialImage, EDITORIAL_IMAGE_URL)

        binding.departmentsRow.removeAllViews()
        DEPARTMENTS.forEach { department ->
            val chipBinding = ItemDepartmentChipBinding.inflate(layoutInflater, binding.departmentsRow, false)
            chipBinding.departmentMonogram.text = department.monogram
            chipBinding.departmentLabel.text = department.label
            chipBinding.root.setOnClickListener { openDiscover() }
            binding.departmentsRow.addView(chipBinding.root)
        }

        binding.closingSoonRow.removeAllViews()
        CLOSING_SOON.forEach { item ->
            val cardBinding = ItemHomeClosingCardBinding.inflate(layoutInflater, binding.closingSoonRow, false)
            cardBinding.categoryText.text = item.category
            cardBinding.titleText.text = item.title
            cardBinding.priceText.text = item.price
            RemoteImageLoader.load(cardBinding.auctionImage, item.imageUrl)
            cardBinding.root.setOnClickListener { openDiscover() }
            binding.closingSoonRow.addView(cardBinding.root)
        }

        binding.featuredCollectionsColumn.removeAllViews()
        FEATURED_COLLECTIONS.forEach { item ->
            val cardBinding =
                ItemFeaturedCollectionCardBinding.inflate(layoutInflater, binding.featuredCollectionsColumn, false)
            cardBinding.titleText.text = item.title
            cardBinding.descriptionText.text = item.description
            cardBinding.reserveText.text = item.reserve
            cardBinding.dateText.text = item.date
            RemoteImageLoader.load(cardBinding.collectionImage, item.imageUrl)
            cardBinding.root.setOnClickListener { openDiscover() }
            binding.featuredCollectionsColumn.addView(cardBinding.root)
        }
    }

    private fun bindActions() {
        binding.topSearchButton.setOnClickListener { openDiscover() }
        binding.topProfileButton.setOnClickListener { openProfile() }
        binding.heroPrimaryButton.setOnClickListener { openDiscover() }
        binding.viewAllButton.setOnClickListener { openDiscover() }
        binding.editorialButton.setOnClickListener { openDiscover() }

        binding.footerHomeButton.setOnClickListener { /* Already here. */ }
        binding.footerDiscoverButton.setOnClickListener { openDiscover() }
        binding.footerWatchlistButton.setOnClickListener { openWatchlistPlaceholder() }
        binding.footerBidsButton.setOnClickListener { openActiveBids() }
    }

    private fun loadScreen() {
        AppExecutors.ioThenMain(
            task = {
                val profile = authRepository.profile()
                val active = auctionRepository.activeAuction()
                HomePayload(profile, active)
            },
            onSuccess = { payload ->
                persistSessionUser(payload.profile)
                renderProfile(payload.profile)
                activeAuction = payload.activeAuction
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No pudimos cargar inicio",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun renderProfile(profile: UserProfile) {
        RemoteImageLoader.load(binding.topProfileAvatar, profile.avatarImageUrl)
    }

    private fun openDiscover() {
        startActivity(Intent(this, AuctionsActivity::class.java))
    }

    private fun openProfile() {
        startActivity(Intent(this, ProfileActivity::class.java))
    }

    private fun openWatchlistPlaceholder() {
        alert(
            "Lista de seguimiento en preparacion",
            "Tu lista de seguimiento personalizada estara disponible pronto. Mientras tanto puedes descubrir catalogos o entrar a tus pujas activas."
        )
    }

    private fun openActiveBids() {
        val current = activeAuction
        if (current == null) {
            alert(
                "Sin pujas activas",
                "Todavia no estas participando activamente en una sala. Explora catalogos desde Subastas para unirte a una sala."
            )
            return
        }

        startActivity(
            Intent(this, AuctionRoomActivity::class.java)
                .putExtra(AuctionRoomActivity.EXTRA_AUCTION_ID, current.auctionId)
        )
    }

    private data class HomePayload(
        val profile: UserProfile,
        val activeAuction: ActiveAuction?
    )

    private data class DepartmentItem(
        val monogram: String,
        val label: String
    )

    private data class ClosingCardItem(
        val category: String,
        val title: String,
        val price: String,
        val imageUrl: String
    )

    private data class FeaturedCollectionItem(
        val title: String,
        val description: String,
        val reserve: String,
        val date: String,
        val imageUrl: String
    )

    companion object {
        private const val HERO_IMAGE_URL =
            "https://lh3.googleusercontent.com/aida-public/AB6AXuCYQjZs5X0w41qC6bScs-5tn7AfTYjUQLY4smDIfJULkbdfZUed09NDgTQ6I1Jt7in91Hby5cGDMw_ak0iUOeiYhmgcYjRaIlP6IcP9LuaIte_IeZlNnLMrk8MudkHVstyNzt4RZkvsl52kBONDxb9Odre8EKZaE-YBC8jtmYGyvGKqaIDSkYQszL4i7ZjBc51-RPB57BmS_hy5PESfHG5scmA5VVDFcdg3j-mlz-FG7w9h2ioNqGoCHiFyMP7e_65fS19eC2sJ_yM"

        private const val EDITORIAL_IMAGE_URL =
            "https://lh3.googleusercontent.com/aida-public/AB6AXuDSoDTbbRHLuZNCFnR0Tq8VR0o-dxEXNUaWVHfu-Prb1XD_izfaz-2eYNxTpHKLSvTTxFbojsMi9bpHngo8alEdr_KJZDSZVHDwMqYhq19d_aOA0FBjGeGzAxBxulFKNVhEr6ALCI6cbsh0TYM4jIsxVvdlMhuRFSu4mxoL7iQnxuBpxg59TnsWIvby2luefGklrj9qshyBkOgkX0Ump7kYULVSSm7VPtPeYXnWQzv6yZZkCGdNOaXtTrFPGtM2jRqOCKr_XtTrh3E"

        private val DEPARTMENTS = listOf(
            DepartmentItem("FA", "Arte"),
            DepartmentItem("W", "Relojes"),
            DepartmentItem("J", "Joyeria"),
            DepartmentItem("F", "Moda"),
            DepartmentItem("S", "Esculturas")
        )

        private val CLOSING_SOON = listOf(
            ClosingCardItem(
                category = "JOYERIA - LOTE 42",
                title = "Zafiro estrella de medianoche",
                price = "$4,200,000",
                imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuCPZGS1OPQFTpNmYmiaf8TIt9shQ8YjSuutPey797Qoq5LQ7sUUJrVE4lKyB8bFQBuv7H7WNonji8FaAq9zq0xzx8Ar9w4x_avicx8usqORyIBbKJAsCmPyS647f2mXUE33nw_pHsnR_eJoOrQOQxSIEUEvZp8zTs7F_KciDRkerqcNMJow8W-NzU5CSDHilV4qjeCrA7MXBBBf-0noPjaSt4p2ddUtEEVA_jlcsarrgMX70L_N1TmhEG1sUdwPumDBQJLymuO_b9g"
            ),
            ClosingCardItem(
                category = "ARTE CONTEMPORANEO - LOTE 12",
                title = "Tensiones geometricas N. 4",
                price = "$850,000",
                imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuAckH-YRrAdaUEMTwf4fMQqF5gbopeF5N3S5tMWzjl6Dq4TnrAR5iKvGKlg223JsnIYxTu6gCWdXskX13SdgW83tUINyt2dqpoRhDmoHEq3rBci73LyrB6CiJ-xUkmL6E5KWrBu6XMiN8shsAwK2sb4U6o_h5fX8MfnK5saFJ9n_GZOC7kzUboOYOKNz4k2JO81d8vf5jA_Uu9V89GnH8i5aZZjvoSD4U4jGes9vtJgfsE2HJDMahQKTZhyT1iIIsllxtaTQW7u0fc"
            )
        )

        private val FEATURED_COLLECTIONS = listOf(
            FeaturedCollectionItem(
                title = "Gautier couture de archivo",
                description = "Organza de seda bordada a mano, coleccion otono 1994. Procedencia: coleccion privada parisina.",
                reserve = "$45,000",
                date = "14 dic",
                imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuCpUvj77KCGJHFih1sezzSJWFp7AnVXxhffQj71jWdsvH8hGfJPYKXWh1JCIP_1LYQDCTN7KWxblI6okrBZ91B_qJaEtjrD4Ulg6tLxRCCyVg-0tSEH2_kT17dizAnWuHISMtFIlJZOOzZJEHYLRroWQtr08daIoFA5Xo-Kq8lE4suqL-yINNzYBiS9SLNEGPA5yXhVL9k8bNtFQ9mw6kD_eioma3b_dmVi4slY0GPhR4nrLpcLLcCtKFttDOCtXskjKCndY1k5NdQ"
            ),
            FeaturedCollectionItem(
                title = "El gran turismo Amalfi",
                description = "Clasico restaurado de 1965. Numeros coincidentes, chasis 0492. Ganador del Concours d'Elegance.",
                reserve = "$1,200,000",
                date = "18 dic",
                imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuCjS39LBwmagvm_ybTqAWn53RXWaprNUowldAtAg1Oda53ZiChwW1qNfLSbkhBiB9VDwMkvIbd_IVuCnGhM4gB8daQU7gBdOnIR7sx7A_oTGd1pDQZULVfJgATUE1JcB6S4fzZ7kps0IhVNjYeezmfJEL71vZViF9V4rwUYYfplVmi9Q_07z8wTxd0oDmb7LU5T62WJTP17ERVZVodap-Kxlxr_Hpyt5oWOydSj2Q89pIgXfLPYbccec-GqUdlyI97dv65LYCO1EQU"
            ),
            FeaturedCollectionItem(
                title = "Interiores modernistas: Paris",
                description = "Una coleccion curada de elementos arquitectonicos de mitad de siglo y mobiliario escultorico.",
                reserve = "$180,000",
                date = "20 dic",
                imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuDfqOzshuX2o1j-uLvDNWdKwAJDpGJiThTMAyHITeFjgi8pomR3x8wrUrFQ5m4vlvr5MSQUz4RAvrU2ZyT2vMkLjfTu445nbuuRLlw5Fo-dj66vA5NI8ITyomqRBAvV6KCQELhRLluPq8mVYmPwpa8vUpXVXq0vcvzkPq4iw5_VmixQbkUqjz5ESaxPDnaZ-DPvb40IaFF40Xu3MmtesFMCe4yXFu60ux3kOFdp2uQoMqdqBe8R2GB86sbxJOVUi_Wygy78D4U5ALo"
            )
        )
    }
}
