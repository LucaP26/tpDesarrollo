package com.anonymous.sistemadesubastas.nativeapp.ui.auctions

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AlertDialog
import androidx.core.view.children
import com.anonymous.sistemadesubastas.databinding.ActivityAuctionRoomBinding
import com.anonymous.sistemadesubastas.databinding.ItemLotCardBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.AuctionDetail
import com.anonymous.sistemadesubastas.nativeapp.data.model.AuctionLot
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuctionRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.Formatters
import com.anonymous.sistemadesubastas.nativeapp.ui.common.RemoteImageLoader
import com.anonymous.sistemadesubastas.nativeapp.ui.home.HomeActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.profile.ProfileActivity
import com.anonymous.sistemadesubastas.nativeapp.system.NetworkStatus

class AuctionRoomActivity : BaseActivity() {
    private lateinit var binding: ActivityAuctionRoomBinding
    private val auctionRepository by lazy { AuctionRepository(apiClient) }
    private val auctionId: Int by lazy { intent.getIntExtra(EXTRA_AUCTION_ID, -1) }
    private var latestNetworkStatus: NetworkStatus = NetworkStatus.disconnected()
    private var receivedNetworkCallback = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }
        if (auctionId <= 0) {
            finish()
            return
        }

        binding = ActivityAuctionRoomBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.backButton.setOnClickListener {
            startActivity(Intent(this, HomeActivity::class.java))
            finish()
        }
        binding.profileButton.setOnClickListener {
            startActivity(Intent(this, ProfileActivity::class.java))
        }
        binding.leaveButton.setOnClickListener { confirmLeaveAuction() }

        sessionManager.userSnapshot()?.avatarImageUrl?.let { avatarUrl ->
            RemoteImageLoader.load(binding.profileAvatar, avatarUrl)
        }

        loadAuction()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    override fun onNetworkStatusChanged(status: NetworkStatus) {
        val previousConnected = latestNetworkStatus.isConnected
        latestNetworkStatus = status
        renderNetworkBanner()
        updateVisibleBidControls()

        if (receivedNetworkCallback && !previousConnected && status.isConnected) {
            toast("Conexion recuperada. Actualizando sala...")
            loadAuction()
        }
        receivedNetworkCallback = true
    }

    private fun loadAuction() {
        AppExecutors.ioThenMain(
            task = { auctionRepository.detail(auctionId) },
            onSuccess = { detail ->
                renderDetail(detail)
            },
            onError = { throwable ->
                alert("No se pudo cargar la sala", throwable.message ?: "Intenta de nuevo.") {
                    finish()
                }
            }
        )
    }

    private fun renderDetail(detail: AuctionDetail) {
        binding.categoryText.text = Formatters.categoryUpper(detail.category)
        binding.auctionTitle.text = detail.title
        binding.auctionMeta.text = Formatters.auctionMeta(detail.location, detail.scheduledAt, detail.auctioneerName)
        binding.lotsContainer.removeAllViews()

        val lots = if (detail.lots.isNotEmpty()) {
            detail.lots
        } else {
            buildList {
                detail.currentLot?.let { add(it) }
                addAll(detail.upcomingLots)
                addAll(detail.completedLots)
            }
        }

        if (lots.isEmpty()) {
            alert("Sala sin lotes", "Todavia no hay lotes disponibles para este catalogo.")
            return
        }

        lots.forEach { lot ->
            val isCurrent = detail.currentLot?.id == lot.id && !lot.sold
            val cardBinding = ItemLotCardBinding.inflate(layoutInflater, binding.lotsContainer, false)
            bindLotCard(cardBinding, detail, lot)

            when {
                isCurrent -> {
                    cardBinding.statusBadge.text = "En vivo"
                    configureBidSection(cardBinding, detail, lot)
                }

                lot.sold && lot.soldToCompany -> {
                    cardBinding.statusBadge.text = "Comprado por la casa"
                    hideBidSection(cardBinding)
                }

                lot.sold -> {
                    cardBinding.statusBadge.text = "Adjudicado"
                    hideBidSection(cardBinding)
                }

                else -> {
                    cardBinding.statusBadge.text = "Proximo"
                    hideBidSection(cardBinding)
                }
            }

            binding.lotsContainer.addView(cardBinding.root)
        }
    }

    private fun bindLotCard(cardBinding: ItemLotCardBinding, detail: AuctionDetail, lot: AuctionLot) {
        cardBinding.pieceNumberText.text = lot.pieceNumber
        cardBinding.lotTitleText.text = lot.title
        cardBinding.lotDescriptionText.text = lot.description
        cardBinding.priceText.text = Formatters.money(detail.currency, lot.currentBid ?: lot.basePrice)
        cardBinding.currentBidText.text = buildBidLine(detail, lot)
        RemoteImageLoader.load(cardBinding.lotImage, lot.imageUrls.firstOrNull())
    }

    private fun configureBidSection(cardBinding: ItemLotCardBinding, detail: AuctionDetail, lot: AuctionLot) {
        if (detail.canBid && lot.canBid) {
            cardBinding.bidButton.tag = TAG_BID_ACTION
            cardBinding.bidInput.visibility = View.VISIBLE
            cardBinding.bidButton.visibility = View.VISIBLE
            cardBinding.bidButton.setOnClickListener {
                placeBid(cardBinding, detail, lot)
            }
        } else {
            cardBinding.bidButton.tag = TAG_REASON_ACTION
            cardBinding.bidInput.visibility = View.GONE
            cardBinding.bidButton.visibility = View.VISIBLE
            cardBinding.bidButton.setOnClickListener {
                alert(
                    "Puja no disponible",
                    lot.blockReason ?: detail.blockReason ?: "No puedes pujar en este lote por el momento."
                )
            }
        }
        applyNetworkStateToBidCard(cardBinding)
    }

    private fun hideBidSection(cardBinding: ItemLotCardBinding) {
        cardBinding.bidInput.visibility = View.GONE
        cardBinding.bidButton.visibility = View.GONE
    }

    private fun placeBid(cardBinding: ItemLotCardBinding, detail: AuctionDetail, lot: AuctionLot) {
        if (!latestNetworkStatus.isConnected) {
            alert(
                "Sin conexion",
                "La red se perdio. Tu puja no se enviara hasta recuperar Wi-Fi o datos moviles."
            )
            return
        }

        val amountText = cardBinding.bidInput.text?.toString()?.trim().orEmpty()
        val amount = amountText.toDoubleOrNull()
        if (amount == null) {
            alert("Monto invalido", "Ingresa un monto numerico para realizar la puja.")
            return
        }

        cardBinding.bidButton.isEnabled = false
        cardBinding.bidButton.text = "Enviando..."

        AppExecutors.ioThenMain(
            task = { auctionRepository.bid(detail.id, lot.id, amount) },
            onSuccess = {
                toast("Puja registrada")
                loadAuction()
            },
            onError = { throwable ->
                cardBinding.bidButton.isEnabled = true
                cardBinding.bidButton.text = "Pujar"
                alert("No se pudo pujar", throwable.message ?: "Intenta de nuevo.")
            }
        )
    }

    private fun confirmLeaveAuction() {
        AlertDialog.Builder(this)
            .setTitle("Abandonar sala")
            .setMessage("Si sales, se quitara tu ultima puja activa y podras entrar a otra subasta.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Abandonar") { _, _ ->
                leaveAuction()
            }
            .show()
    }

    private fun leaveAuction() {
        AppExecutors.ioThenMain(
            task = { auctionRepository.leave(auctionId) },
            onSuccess = { result ->
                toast(result.message)
                startActivity(
                    Intent(this, AuctionsActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                )
                finish()
            },
            onError = { throwable ->
                alert("No se pudo abandonar", throwable.message ?: "Intenta de nuevo.")
            }
        )
    }

    private fun buildBidLine(detail: AuctionDetail, lot: AuctionLot): String {
        val current = Formatters.money(detail.currency, lot.currentBid ?: lot.basePrice)
        val min = Formatters.money(detail.currency, lot.minBid)
        val max = lot.maxBid?.let { Formatters.money(detail.currency, it) }
        return if (max != null) {
            "Actual: $current  |  Minimo: $min  |  Maximo: $max"
        } else {
            "Actual: $current  |  Minimo: $min"
        }
    }

    private fun renderNetworkBanner() {
        binding.networkBanner.visibility = if (latestNetworkStatus.isConnected) View.GONE else View.VISIBLE
    }

    private fun updateVisibleBidControls() {
        binding.lotsContainer.children.forEach { child ->
            val bidButton = child.findViewById<Button>(com.anonymous.sistemadesubastas.R.id.bidButton) ?: return@forEach
            val bidInput = child.findViewById<EditText>(com.anonymous.sistemadesubastas.R.id.bidInput) ?: return@forEach
            applyNetworkStateToControls(bidButton, bidInput)
        }
    }

    private fun applyNetworkStateToBidCard(cardBinding: ItemLotCardBinding) {
        applyNetworkStateToControls(cardBinding.bidButton, cardBinding.bidInput)
    }

    private fun applyNetworkStateToControls(bidButton: Button, bidInput: EditText) {
        if (bidButton.visibility != View.VISIBLE) {
            return
        }

        val mode = bidButton.tag as? String
        if (mode == TAG_REASON_ACTION) {
            bidButton.isEnabled = true
            bidButton.text = "Ver motivo"
            return
        }

        val isConnected = latestNetworkStatus.isConnected
        bidInput.isEnabled = isConnected
        bidButton.isEnabled = isConnected
        bidButton.text = if (isConnected) "Pujar" else "Sin conexion"
    }

    companion object {
        const val EXTRA_AUCTION_ID = "extra_auction_id"
        private const val TAG_BID_ACTION = "bid_action"
        private const val TAG_REASON_ACTION = "reason_action"
    }
}
