package com.anonymous.sistemadesubastas.nativeapp.ui.auctions

import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
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
import com.anonymous.sistemadesubastas.nativeapp.data.model.PaymentMethod
import com.anonymous.sistemadesubastas.nativeapp.data.network.AuctionRealtimeClient
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuctionRepository
import com.anonymous.sistemadesubastas.nativeapp.data.repository.ProfileRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.FooterTab
import com.anonymous.sistemadesubastas.nativeapp.ui.common.Formatters
import com.anonymous.sistemadesubastas.nativeapp.ui.common.RemoteImageLoader
import com.anonymous.sistemadesubastas.nativeapp.ui.home.HomeActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.profile.ProfileActivity
import com.anonymous.sistemadesubastas.nativeapp.system.NetworkStatus
import java.util.Locale

class AuctionRoomActivity : BaseActivity() {
    private lateinit var binding: ActivityAuctionRoomBinding
    private val auctionRepository by lazy { AuctionRepository(apiClient) }
    private val profileRepository by lazy { ProfileRepository(apiClient) }
    private val realtimeClient by lazy {
        AuctionRealtimeClient(
            tokenProvider = { sessionManager.token() },
            onBidUpdate = {
                runOnUiThread {
                    loadAuction()
                }
            },
        )
    }
    private val auctionId: Int by lazy { intent.getIntExtra(EXTRA_AUCTION_ID, -1) }
    private val publicMode: Boolean by lazy { intent.getBooleanExtra(EXTRA_PUBLIC_MODE, false) }
    private var latestNetworkStatus: NetworkStatus = NetworkStatus.disconnected()
    private var receivedNetworkCallback = false
    private var lotCountdown: CountDownTimer? = null
    private var paymentMethods: List<PaymentMethod> = emptyList()
    private var selectedPaymentMethodId: Int? = null
    private var liveJoinAttempted = false
    private val knownWonLotIds = mutableSetOf<Int>()
    private var initializedWonLots = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!publicMode && !sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }
        if (auctionId <= 0) {
            finish()
            return
        }

        binding = ActivityAuctionRoomBinding.inflate(layoutInflater)
        setContentView(binding.root)
        if (publicMode) {
            binding.footerNav.root.visibility = View.GONE
            binding.profileButton.visibility = View.INVISIBLE
        } else {
            bindFooterNavigation(binding.footerNav, FooterTab.BIDS)
        }

        binding.backButton.setOnClickListener {
            if (!publicMode) {
                startActivity(Intent(this, HomeActivity::class.java))
            }
            finish()
        }
        binding.profileButton.setOnClickListener {
            if (!publicMode) {
                startActivity(Intent(this, ProfileActivity::class.java))
            }
        }
        binding.leaveButton.setOnClickListener { confirmLeaveAuction() }

        if (!publicMode) {
            sessionManager.userSnapshot()?.avatarImageUrl?.let { avatarUrl ->
                RemoteImageLoader.load(binding.profileAvatar, avatarUrl)
            }
        }

        loadAuction()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    override fun onNetworkStatusChanged(status: NetworkStatus) {
        val previousConnected = canUseCurrentNetwork(latestNetworkStatus)
        latestNetworkStatus = status
        renderNetworkBanner()
        updateVisibleBidControls()

        if (receivedNetworkCallback && !previousConnected && canUseCurrentNetwork(status)) {
            toast("Conexion recuperada. Actualizando sala...")
            loadAuction()
        }
        receivedNetworkCallback = true
    }

    private fun loadAuction() {
        AppExecutors.ioThenMain(
            task = {
                val detail = if (publicMode) auctionRepository.publicDetail(auctionId) else auctionRepository.detail(auctionId)
                val payments = if (publicMode) emptyList() else profileRepository.paymentMethods()
                AuctionRoomPayload(detail, payments)
            },
            onSuccess = { payload ->
                paymentMethods = payload.paymentMethods
                ensureSelectedPayment(payload.detail)
                renderDetail(payload.detail)
                syncRealtimeConnection(payload.detail)
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No se pudo cargar la sala",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo.",
                    onDismiss = { finish() }
                )
            }
        )
    }

    private fun renderDetail(detail: AuctionDetail) {
        lotCountdown?.cancel()
        lotCountdown = null

        binding.categoryText.text = Formatters.categoryUpper(detail.category)
        binding.auctionTitle.text = detail.title
        binding.auctionMeta.text = Formatters.auctionMeta(detail.location, detail.scheduledAt, detail.auctioneerName)
        binding.leaveButton.visibility = if (detail.connected) View.VISIBLE else View.GONE
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
        handleWonLotAlerts(detail, lots)

        if (lots.isEmpty()) {
            alert("Sala sin lotes", "Todavia no hay lotes disponibles para este catalogo.")
            return
        }

        lots.forEach { lot ->
            val isCurrent = detail.currentLot?.id == lot.id && !lot.sold
            val cardBinding = ItemLotCardBinding.inflate(layoutInflater, binding.lotsContainer, false)
            bindLotCard(cardBinding, detail, lot)

            when {
                detail.state == STATE_SCHEDULED -> {
                    cardBinding.statusBadge.text = "Programado"
                    hideBidSection(cardBinding)
                }

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
        val meta = buildLotMeta(lot)
        cardBinding.lotMetaText.visibility = if (meta.isBlank()) View.GONE else View.VISIBLE
        cardBinding.lotMetaText.text = meta
        cardBinding.lotStoryText.visibility = if (lot.story.isNullOrBlank()) View.GONE else View.VISIBLE
        cardBinding.lotStoryText.text = lot.story.orEmpty()
        if (!lot.priceAvailable) {
            cardBinding.priceText.text = "Precio visible al registrarte"
            cardBinding.currentBidText.text = "Inicia sesion con una cuenta aprobada para ver valores y ofertas."
            cardBinding.bidHistoryText.visibility = View.GONE
        } else {
            cardBinding.priceText.text = Formatters.money(detail.currency, lot.currentBid ?: lot.basePrice)
            cardBinding.currentBidText.text = if (detail.state == STATE_SCHEDULED) {
                "Precio base visible. Las pujas se habilitaran cuando la sala este disponible."
            } else {
                buildBidLine(detail, lot)
            }
            val bidHistory = buildBidHistoryLine(detail, lot)
            cardBinding.bidHistoryText.visibility = if (bidHistory.isBlank()) View.GONE else View.VISIBLE
            cardBinding.bidHistoryText.text = bidHistory
        }
        RemoteImageLoader.load(cardBinding.lotImage, lot.imageUrls.firstOrNull())
    }

    private fun configureBidSection(cardBinding: ItemLotCardBinding, detail: AuctionDetail, lot: AuctionLot) {
        configureCountdown(cardBinding, lot)
        if (detail.canBid && lot.canBid) {
            cardBinding.bidButton.tag = TAG_BID_ACTION
            configurePaymentSelector(cardBinding, detail)
            cardBinding.bidInput.visibility = View.VISIBLE
            cardBinding.paymentSelectorButton.visibility = View.VISIBLE
            cardBinding.bidButton.visibility = View.VISIBLE
            cardBinding.bidButton.setOnClickListener {
                placeBid(cardBinding, detail, lot)
            }
        } else {
            cardBinding.bidButton.tag = TAG_REASON_ACTION
            cardBinding.bidInput.visibility = View.GONE
            cardBinding.paymentSelectorButton.visibility = View.GONE
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
        cardBinding.timerText.visibility = View.GONE
        cardBinding.bidInput.visibility = View.GONE
        cardBinding.paymentSelectorButton.visibility = View.GONE
        cardBinding.bidButton.visibility = View.GONE
    }

    private fun configureCountdown(cardBinding: ItemLotCardBinding, lot: AuctionLot) {
        val remaining = lot.bidSecondsRemaining
        if (remaining == null) {
            cardBinding.timerText.visibility = View.GONE
            return
        }

        cardBinding.timerText.visibility = View.VISIBLE
        renderCountdown(cardBinding, remaining)
        lotCountdown = object : CountDownTimer((remaining.coerceAtLeast(0) * 1000L), 1000L) {
            override fun onTick(millisUntilFinished: Long) {
                val seconds = ((millisUntilFinished + 999L) / 1000L).toInt()
                renderCountdown(cardBinding, seconds)
            }

            override fun onFinish() {
                cardBinding.timerText.text = "Tiempo agotado. Actualizando lote..."
                loadAuction()
            }
        }.start()
    }

    private fun renderCountdown(cardBinding: ItemLotCardBinding, seconds: Int) {
        val clamped = seconds.coerceAtLeast(0)
        cardBinding.timerText.text = String.format(
            Locale.ROOT,
            "Tiempo restante para este lote: %02d:%02d",
            clamped / 60,
            clamped % 60
        )
    }

    private fun handleWonLotAlerts(detail: AuctionDetail, lots: List<AuctionLot>) {
        if (publicMode) {
            return
        }
        val userId = sessionManager.userSnapshot()?.id ?: return
        val wonLots = lots.filter { lot ->
            lot.sold && !lot.soldToCompany && lot.currentBidderId == userId
        }
        if (!initializedWonLots) {
            knownWonLotIds += wonLots.map { it.id }
            initializedWonLots = true
            return
        }
        wonLots
            .filterNot { knownWonLotIds.contains(it.id) }
            .forEach { lot ->
                knownWonLotIds += lot.id
                alert(
                    "Ganaste el item",
                    "Ganaste ${lot.title} por ${Formatters.money(detail.currency, lot.currentBid ?: lot.basePrice)}. Ya aparece en Perfil, en Articulos ganados."
                )
            }
    }

    private fun placeBid(cardBinding: ItemLotCardBinding, detail: AuctionDetail, lot: AuctionLot) {
        if (!canUseCurrentNetwork(latestNetworkStatus)) {
            alert(
                "Sin conexion",
                "Tu puja necesita Wi-Fi o datos moviles autorizados para enviarse correctamente."
            )
            return
        }

        val amountText = cardBinding.bidInput.text?.toString()?.trim().orEmpty()
        val amount = amountText.toDoubleOrNull()
        if (amount == null) {
            alert("Monto invalido", "Ingresa un monto numerico para realizar la puja.")
            return
        }
        val paymentMethodId = selectedPaymentMethodId
        if (paymentMethodId == null) {
            alert("Medio de pago requerido", "Selecciona un medio de pago verificado en ${detail.currency} para esta puja.")
            return
        }
        cardBinding.bidButton.isEnabled = false
        cardBinding.bidButton.text = "Enviando..."

        AppExecutors.ioThenMain(
            task = {
                val join = auctionRepository.join(detail.id)
                if (!join.connected || !join.canBid) {
                    throw RuntimeException(join.blockReason ?: "No podes pujar en esta subasta.")
                }
                auctionRepository.bid(detail.id, lot.id, amount, paymentMethodId)
            },
            onSuccess = {
                toast("Puja registrada")
                loadAuction()
            },
            onError = { throwable ->
                cardBinding.bidButton.isEnabled = true
                cardBinding.bidButton.text = "Pujar"
                showErrorOrHandleSession(
                    title = "No se pudo pujar",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun confirmLeaveAuction() {
        val dialog = AlertDialog.Builder(this)
            .setTitle("Abandonar sala")
            .setMessage("Si sales, se quitara tu ultima puja activa y podras entrar a otra subasta.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Abandonar") { _, _ ->
                leaveAuction()
            }
            .create()
        styleDialogButtons(dialog)
        dialog.show()
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
                showErrorOrHandleSession(
                    title = "No se pudo abandonar",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
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

    private fun buildBidHistoryLine(detail: AuctionDetail, lot: AuctionLot): String {
        if (lot.bidHistory.isEmpty()) {
            return ""
        }
        val offers = lot.bidHistory.takeLast(5).joinToString("  |  ") { bid ->
            val owner = if (bid.isMine) "Vos" else "Postor"
            "$owner ${Formatters.money(detail.currency, bid.amount)}"
        }
        return "Ofertas visibles: $offers"
    }

    private fun buildLotMeta(lot: AuctionLot): String {
        return buildList {
            lot.ownerName?.let { add("Dueno actual: $it") }
            lot.artist?.let { add("Artista/disenador: $it") }
        }.joinToString("  |  ")
    }

    private fun renderNetworkBanner() {
        binding.networkBanner.visibility = if (canUseCurrentNetwork(latestNetworkStatus)) View.GONE else View.VISIBLE
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

        val isConnected = canUseCurrentNetwork(latestNetworkStatus)
        bidInput.isEnabled = isConnected
        bidButton.isEnabled = isConnected
        bidButton.text = if (isConnected) "Pujar" else "Sin conexion"
    }

    private fun syncRealtimeConnection(detail: AuctionDetail) {
        if (publicMode || detail.state != STATE_OPEN) {
            realtimeClient.disconnect()
            return
        }
        if (detail.connected) {
            realtimeClient.connect(detail.id)
            return
        }
        if (liveJoinAttempted) {
            return
        }
        liveJoinAttempted = true
        AppExecutors.ioThenMain(
            task = { auctionRepository.join(detail.id) },
            onSuccess = { result ->
                if (result.connected) {
                    realtimeClient.connect(detail.id)
                    loadAuction()
                }
            },
            onError = {
                // Users without access or without registered payment can still inspect the catalog.
            },
        )
    }

    private fun eligiblePayments(detail: AuctionDetail): List<PaymentMethod> {
        return paymentMethods.filter { payment ->
            payment.status.equals("verificado", ignoreCase = true) &&
                payment.currency.equals(detail.currency, ignoreCase = true)
        }
    }

    private fun ensureSelectedPayment(detail: AuctionDetail) {
        val eligible = eligiblePayments(detail)
        if (eligible.none { it.id == selectedPaymentMethodId }) {
            selectedPaymentMethodId = eligible.firstOrNull()?.id
        }
    }

    private fun configurePaymentSelector(cardBinding: ItemLotCardBinding, detail: AuctionDetail) {
        val eligible = eligiblePayments(detail)
        val selected = eligible.firstOrNull { it.id == selectedPaymentMethodId }
        cardBinding.paymentSelectorButton.text = selected?.let { paymentLabel(it) } ?: "Seleccionar medio de pago"
        cardBinding.paymentSelectorButton.setOnClickListener {
            if (eligible.isEmpty()) {
                alert("Sin medio verificado", "Necesitas un medio de pago verificado en ${detail.currency}.")
                return@setOnClickListener
            }
            val labels = eligible.map(::paymentLabel).toTypedArray()
            AlertDialog.Builder(this)
                .setTitle("Medio de pago")
                .setItems(labels) { dialog, index ->
                    selectedPaymentMethodId = eligible[index].id
                    cardBinding.paymentSelectorButton.text = labels[index]
                    dialog.dismiss()
                }
                .show()
        }
    }

    private fun paymentLabel(payment: PaymentMethod): String {
        val amount = payment.availableAmount?.let { Formatters.money(payment.currency, it) } ?: payment.currency
        return "${payment.displayName} - $amount"
    }

    companion object {
        const val EXTRA_AUCTION_ID = "extra_auction_id"
        const val EXTRA_PUBLIC_MODE = "extra_public_mode"
        private const val STATE_SCHEDULED = "programada"
        private const val STATE_OPEN = "abierta"
        private const val TAG_BID_ACTION = "bid_action"
        private const val TAG_REASON_ACTION = "reason_action"
    }

    override fun onDestroy() {
        lotCountdown?.cancel()
        lotCountdown = null
        realtimeClient.disconnect()
        super.onDestroy()
    }

    private data class AuctionRoomPayload(
        val detail: AuctionDetail,
        val paymentMethods: List<PaymentMethod>,
    )
}
