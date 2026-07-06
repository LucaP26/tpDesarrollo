package com.anonymous.sistemadesubastas.nativeapp.ui.profile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.text.InputFilter
import android.util.Base64
import android.util.TypedValue
import android.view.View
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import com.anonymous.sistemadesubastas.R
import com.anonymous.sistemadesubastas.databinding.ActivityProfileBinding
import com.anonymous.sistemadesubastas.databinding.ItemPaymentMethodBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.ActiveAuction
import com.anonymous.sistemadesubastas.nativeapp.data.model.Metrics
import com.anonymous.sistemadesubastas.nativeapp.data.model.PaymentMethod
import com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile
import com.anonymous.sistemadesubastas.nativeapp.data.model.WonItem
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuctionRepository
import com.anonymous.sistemadesubastas.nativeapp.data.repository.ProfileRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.auctions.AuctionRoomActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.auctions.AuctionsActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.auth.ChangePasswordActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.Formatters
import com.anonymous.sistemadesubastas.nativeapp.ui.common.RemoteImageLoader
import com.anonymous.sistemadesubastas.nativeapp.ui.home.HomeActivity

class ProfileActivity : BaseActivity() {
    private lateinit var binding: ActivityProfileBinding
    private val profileRepository by lazy { ProfileRepository(apiClient) }
    private val auctionRepository by lazy { AuctionRepository(apiClient) }
    private var currentProfile: UserProfile? = null
    private var activeAuction: ActiveAuction? = null
    private var isUpdatingAvatar = false
    private var isEditingProfile = false
    private var isSavingProfile = false

    private val lettersOnlyFilter = InputFilter { source, _, _, _, _, _ ->
        if (source == null) {
            return@InputFilter null
        }
        val filtered = source.filter { character ->
            character.isLetter() || character.isWhitespace() || character == '\'' || character == '-'
        }
        if (filtered == source.toString()) null else filtered
    }

    private val paymentMethodLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                loadProfile()
            }
        }

    private val galleryPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                openGallery()
            } else {
                alert(
                    "Permiso denegado",
                    "Necesitamos acceso a tu galeria para actualizar la foto de perfil.",
                )
            }
        }

    private val galleryLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            if (uri == null) {
                return@registerForActivityResult
            }

            try {
                val document = readSelectedDocument(uri)
                if (!isAllowedImage(document)) {
                    alert("Formato no valido", "Solo se permiten imagenes PNG o JPG para la foto de perfil.")
                    return@registerForActivityResult
                }
                if (document.sizeBytes != null && document.sizeBytes > MAX_AVATAR_SIZE_BYTES) {
                    alert("Archivo demasiado grande", "La foto de perfil debe pesar menos de 5 MB.")
                    return@registerForActivityResult
                }

                uploadAvatar(document.dataUrl)
            } catch (error: Exception) {
                alert(
                    "No se pudo abrir la imagen",
                    error.message ?: "No pudimos leer la foto seleccionada.",
                )
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }

        binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)

        applyInputRules()
        bindActions()
        updateSectionChevron(binding.personalSection, binding.personalChevron)
        updateSectionChevron(binding.paymentSection, binding.paymentChevron)
        updateProfileEditingState()

        sessionManager.userSnapshot()?.let {
            currentProfile = it
            renderProfile(it)
        }
        loadProfile()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    private fun applyInputRules() {
        binding.firstNameInput.filters = arrayOf(lettersOnlyFilter)
        binding.lastNameInput.filters = arrayOf(lettersOnlyFilter)
    }

    private fun bindActions() {
        binding.menuButton.setOnClickListener { onBackPressedDispatcher.onBackPressed() }
        binding.headerCameraButton.setOnClickListener { beginAvatarSelection() }
        binding.profileAvatar.setOnClickListener { beginAvatarSelection() }
        binding.profileAvatarFrame.setOnClickListener { beginAvatarSelection() }
        binding.logoutButton.setOnClickListener {
            sessionManager.clear()
            restartToLogin()
        }

        binding.personalRow.setOnClickListener {
            toggleSection(binding.personalSection, binding.personalChevron)
        }
        binding.paymentRow.setOnClickListener {
            toggleSection(binding.paymentSection, binding.paymentChevron)
        }

        binding.personalEditButton.setOnClickListener {
            if (isSavingProfile) {
                return@setOnClickListener
            }
            if (isEditingProfile) {
                setProfileEditing(enabled = false, restoreValues = true)
            } else {
                setProfileEditing(enabled = true, restoreValues = false)
            }
        }
        binding.saveProfileButton.setOnClickListener { submitProfileUpdate() }
        binding.addPaymentMethodButton.setOnClickListener {
            paymentMethodLauncher.launch(Intent(this, PaymentMethodFormActivity::class.java))
        }

        binding.sellRow.setOnClickListener {
            startActivity(Intent(this, ConsignmentActivity::class.java))
        }
        binding.securityRow.setOnClickListener {
            startActivity(Intent(this, ChangePasswordActivity::class.java))
        }
        binding.supportRow.setOnClickListener {
            startActivity(Intent(this, MessagesActivity::class.java))
        }

        binding.footerHomeButton.setOnClickListener { openHome() }
        binding.footerDiscoverButton.setOnClickListener { openDiscover() }
        binding.footerWatchlistButton.setOnClickListener {
            alert(
                "Lista de seguimiento en preparacion",
                "Tu lista de seguimiento personalizada estara disponible pronto."
            )
        }
        binding.footerBidsButton.setOnClickListener { openActiveBids() }
    }

    private fun loadProfile() {
        AppExecutors.ioThenMain(
            task = {
                val profile = profileRepository.profile()
                val paymentMethods = profileRepository.paymentMethods()
                val metrics = profileRepository.metrics()
                val activeAuction = auctionRepository.activeAuction()
                ProfilePayload(profile, paymentMethods, metrics, activeAuction)
            },
            onSuccess = { payload ->
                persistSessionUser(payload.profile)
                currentProfile = payload.profile
                activeAuction = payload.activeAuction
                renderProfile(payload.profile)
                renderPaymentMethods(payload.paymentMethods)
                renderMetrics(payload.metrics)
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No se pudo cargar el perfil",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun renderProfile(profile: UserProfile) {
        binding.fullNameText.text = profile.fullName
        binding.memberSinceText.text = "Miembro de ATELIER"
        binding.categoryText.text = "Categoria ${Formatters.categoryUpper(profile.category)}"
        if (!isEditingProfile) {
            binding.firstNameInput.setText(profile.firstName)
            binding.lastNameInput.setText(profile.lastName)
            binding.emailInput.setText(profile.email)
            binding.addressInput.setText(profile.legalAddress)
        }
        RemoteImageLoader.load(binding.profileAvatar, profile.avatarImageUrl)
    }

    private fun renderPaymentMethods(paymentMethods: List<PaymentMethod>) {
        binding.paymentMethodsContainer.removeAllViews()
        binding.paymentEmptyText.visibility = if (paymentMethods.isEmpty()) View.VISIBLE else View.GONE

        paymentMethods.forEach { paymentMethod ->
            val itemBinding = ItemPaymentMethodBinding.inflate(layoutInflater, binding.paymentMethodsContainer, false)
            itemBinding.paymentTitle.text = paymentMethod.displayName
            itemBinding.paymentSubtitle.text = buildPaymentSubtitle(paymentMethod)
            itemBinding.paymentStatus.text = paymentStatusLabel(paymentMethod.status)
            itemBinding.paymentDeleteButton.setOnClickListener {
                confirmDeletePaymentMethod(paymentMethod)
            }
            binding.paymentMethodsContainer.addView(itemBinding.root)
        }
    }

    private fun renderMetrics(metrics: Metrics) {
        binding.metricsSummaryText.text = (
            "Asistidas: ${metrics.auctionsJoined}  |  Ganadas: ${metrics.auctionsWon}  |  " +
                "Pujas activas: ${metrics.activeBids}"
            )
        binding.metricsAmountText.text = (
            "Ofertado total: ${metrics.totalAmountBid}  |  " +
                "Adjudicado/pagado: ${metrics.totalAmountPaid}"
            )
        val categories = metrics.categoriesJoined.entries.joinToString("  |  ") { entry ->
            "${Formatters.categoryUpper(entry.key)} ${entry.value}"
        }
        binding.metricsCategoryText.visibility = if (categories.isBlank()) View.GONE else View.VISIBLE
        binding.metricsCategoryText.text = "Categorias: $categories"
        binding.wonItemsText.text = if (metrics.wonItems.isEmpty()) {
            "Articulos ganados: todavia no ganaste articulos."
        } else {
            metrics.wonItems.joinToString("\n") { item ->
                "${item.pieceNumber} - ${item.title} - Total ${Formatters.money(item.currency, item.totalAmount)}"
            }
        }
        binding.wonItemsText.setOnClickListener {
            if (metrics.wonItems.isNotEmpty()) {
                showWonItemSelector(metrics.wonItems)
            }
        }
    }

    private fun showWonItemSelector(items: List<WonItem>) {
        if (items.size == 1) {
            showWonItemDetail(items.first())
            return
        }
        val labels = items.map { "${it.pieceNumber} - ${it.title}" }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Articulos ganados")
            .setItems(labels) { dialog, index ->
                dialog.dismiss()
                showWonItemDetail(items[index])
            }
            .show()
    }

    private fun showWonItemDetail(item: WonItem) {
        val message = buildString {
            appendLine(item.description.ifBlank { "Sin descripcion cargada." })
            appendLine()
            appendLine("Oferta ganadora: ${Formatters.money(item.currency, item.hammerPrice)}")
            appendLine("Impuestos/comisiones adjudicadas: ${Formatters.money(item.currency, item.taxAmount)}")
            appendLine("Costo de envio: ${Formatters.money(item.currency, item.shippingAmount)}")
            appendLine("Total pagado/adjudicado: ${Formatters.money(item.currency, item.totalAmount)}")
            appendLine()
            appendLine("Coordinacion de entrega")
            appendLine("Iniciar antes de: ${Formatters.dateTime(item.shippingDeadlineAt)}")
            appendLine("Multa por demora: ${Formatters.money(item.currency, item.shippingPenaltyAmount)}")
            appendLine(
                if (item.shippingCoordinationStarted) {
                    "Estado: coordinacion iniciada."
                } else {
                    "Si no comenzas la coordinacion dentro de las 48 horas posteriores a ganar el item, se aplicara esta multa."
                }
            )
            appendLine()
            appendLine("Vendedor: ${item.sellerName ?: "Malena Garcia"}")
            appendLine(item.sellerEmail ?: "m@gmail.com")
        }
        AlertDialog.Builder(this)
            .setTitle("${item.pieceNumber} - ${item.title}")
            .setMessage(message)
            .setNegativeButton("Cerrar", null)
            .setPositiveButton("Coordinar envio") { _, _ -> openShippingChat(item) }
            .show()
    }

    private fun openShippingChat(item: WonItem) {
        AppExecutors.ioThenMain(
            task = { profileRepository.openShippingChat(item.purchaseId) },
            onSuccess = { thread ->
                startActivity(
                    Intent(this, MessagesActivity::class.java)
                        .putExtra(MessagesActivity.EXTRA_THREAD_ID, thread.id)
                )
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No pudimos abrir el chat",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun buildPaymentSubtitle(paymentMethod: PaymentMethod): String {
        val values = mutableListOf<String>()
        values += paymentTypeLabel(paymentMethod.type)
        val holderName = listOfNotNull(paymentMethod.holderFirstName, paymentMethod.holderLastName)
            .filter { it.isNotBlank() }
            .joinToString(" ")
        if (holderName.isNotBlank()) {
            values += holderName
        }
        paymentMethod.currency.takeIf { it.isNotBlank() }?.let(values::add)
        paymentMethod.issuingBank?.let(values::add)
        paymentMethod.lastFour?.let { values += "****$it" }
        paymentMethod.expirationDate?.let { values += "Vence $it" }
        paymentMethod.availableAmount
            ?.takeIf { it > 0.0 }
            ?.let { values += "Monto ${Formatters.money(paymentMethod.currency, it)}" }
        return values.joinToString(" - ")
    }

    private fun paymentTypeLabel(type: String): String {
        return when (type) {
            PaymentMethodFormActivity.PAYMENT_CARD -> "Tarjeta de credito"
            PaymentMethodFormActivity.PAYMENT_BANK -> "Cuenta bancaria"
            PaymentMethodFormActivity.PAYMENT_CHECK -> "Cheque"
            else -> "Medio de pago"
        }
    }

    private fun paymentStatusLabel(status: String): String {
        return when (status.lowercase()) {
            "verificado" -> "Verificado"
            "rechazado" -> "Rechazado"
            else -> "Pendiente"
        }
    }

    private fun beginAvatarSelection() {
        if (isUpdatingAvatar) {
            return
        }
        if (hasGalleryPermission()) {
            openGallery()
        } else {
            galleryPermissionLauncher.launch(requiredGalleryPermission())
        }
    }

    private fun openGallery() {
        galleryLauncher.launch("image/*")
    }

    private fun uploadAvatar(dataUrl: String) {
        isUpdatingAvatar = true
        binding.headerCameraButton.isEnabled = false
        binding.headerCameraButton.alpha = 0.65f

        AppExecutors.ioThenMain(
            task = { profileRepository.updateAvatar(dataUrl) },
            onSuccess = { profile ->
                isUpdatingAvatar = false
                binding.headerCameraButton.isEnabled = true
                binding.headerCameraButton.alpha = 1f
                persistSessionUser(profile)
                currentProfile = profile
                renderProfile(profile)
                toast("Foto de perfil actualizada.")
            },
            onError = { throwable ->
                isUpdatingAvatar = false
                binding.headerCameraButton.isEnabled = true
                binding.headerCameraButton.alpha = 1f
                showErrorOrHandleSession(
                    title = "No se pudo actualizar la foto",
                    throwable = throwable,
                    fallbackMessage = "Intenta nuevamente."
                )
            }
        )
    }

    private fun submitProfileUpdate() {
        if (isSavingProfile) {
            return
        }

        val firstName = binding.firstNameInput.text?.toString().orEmpty().trim()
        val lastName = binding.lastNameInput.text?.toString().orEmpty().trim()
        val email = binding.emailInput.text?.toString().orEmpty().trim().lowercase()
        val legalAddress = binding.addressInput.text?.toString().orEmpty().trim()

        if (firstName.isBlank() || lastName.isBlank() || email.isBlank() || legalAddress.isBlank()) {
            alert("Faltan datos", "Completa nombre, apellido, correo electronico y direccion principal.")
            return
        }
        if (!email.contains("@")) {
            alert("Mail invalido", "Ingresa un correo electronico valido que contenga @.")
            return
        }

        isSavingProfile = true
        binding.saveProfileButton.isEnabled = false
        binding.personalEditButton.isEnabled = false

        AppExecutors.ioThenMain(
            task = { profileRepository.updateProfile(firstName, lastName, email, legalAddress) },
            onSuccess = { profile ->
                isSavingProfile = false
                binding.saveProfileButton.isEnabled = true
                binding.personalEditButton.isEnabled = true
                currentProfile = profile
                persistSessionUser(profile)
                setProfileEditing(enabled = false, restoreValues = false)
                renderProfile(profile)
                toast("Informacion personal actualizada.")
            },
            onError = { throwable ->
                isSavingProfile = false
                binding.saveProfileButton.isEnabled = true
                binding.personalEditButton.isEnabled = true
                showErrorOrHandleSession(
                    title = "No se pudo actualizar el perfil",
                    throwable = throwable,
                    fallbackMessage = "Intenta nuevamente."
                )
            }
        )
    }

    private fun setProfileEditing(enabled: Boolean, restoreValues: Boolean) {
        isEditingProfile = enabled
        if (restoreValues) {
            currentProfile?.let(::renderProfile)
        }
        updateProfileEditingState()
    }

    private fun updateProfileEditingState() {
        binding.firstNameInput.isEnabled = isEditingProfile
        binding.lastNameInput.isEnabled = isEditingProfile
        binding.emailInput.isEnabled = isEditingProfile
        binding.addressInput.isEnabled = isEditingProfile
        binding.personalEditButton.text = if (isEditingProfile) "Cancelar" else "Editar"
        binding.saveProfileButton.visibility = if (isEditingProfile) View.VISIBLE else View.GONE
    }

    private fun confirmDeletePaymentMethod(paymentMethod: PaymentMethod) {
        val titleView = TextView(this).apply {
            text = "Eliminar medio de pago"
            setTextColor(ContextCompat.getColor(context, R.color.atelier_action))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(56, 42, 56, 0)
        }

        val dialog = AlertDialog.Builder(this)
            .setCustomTitle(titleView)
            .setMessage("Se eliminara ${paymentMethod.displayName} de tu perfil. Esta accion es inmediata.")
            .setNegativeButton("Cancelar") { alertDialog, _ ->
                alertDialog.dismiss()
            }
            .setPositiveButton("Eliminar") { alertDialog, _ ->
                alertDialog.dismiss()
                deletePaymentMethod(paymentMethod)
            }
            .create()

        styleDialogButtons(dialog)
        dialog.show()
    }

    private fun deletePaymentMethod(paymentMethod: PaymentMethod) {
        AppExecutors.ioThenMain(
            task = { profileRepository.deletePaymentMethod(paymentMethod.id) },
            onSuccess = { message ->
                toast(message)
                loadProfile()
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No se pudo eliminar el medio de pago",
                    throwable = throwable,
                    fallbackMessage = "Intenta nuevamente."
                )
            }
        )
    }

    private fun toggleSection(section: View, chevron: TextView) {
        section.visibility = if (section.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        updateSectionChevron(section, chevron)
    }

    private fun updateSectionChevron(section: View, chevron: TextView) {
        chevron.text = "\u203A"
        chevron.rotation = if (section.visibility == View.VISIBLE) 90f else 0f
    }

    private fun openHome() {
        startActivity(Intent(this, HomeActivity::class.java))
        finish()
    }

    private fun openDiscover() {
        startActivity(Intent(this, AuctionsActivity::class.java))
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

    private fun hasGalleryPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, requiredGalleryPermission()) == PackageManager.PERMISSION_GRANTED
    }

    private fun requiredGalleryPermission(): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_IMAGES
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }
    }

    private fun readSelectedDocument(uri: Uri): SelectedImage {
        val mimeType = contentResolver.getType(uri).orEmpty()
        val bytes = contentResolver.openInputStream(uri)?.use { input -> input.readBytes() }
            ?: throw IllegalStateException("No pudimos leer el archivo seleccionado.")
        val dataUrl = "data:${if (mimeType.isBlank()) "image/jpeg" else mimeType};base64,${
            Base64.encodeToString(bytes, Base64.NO_WRAP)
        }"

        var displayName = "avatar.jpg"
        var sizeBytes: Long? = bytes.size.toLong()
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIndex >= 0) {
                        displayName = cursor.getString(nameIndex) ?: displayName
                    }
                    val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
                        sizeBytes = cursor.getLong(sizeIndex)
                    }
                }
            }

        return SelectedImage(
            dataUrl = dataUrl,
            displayName = displayName,
            mimeType = mimeType,
            sizeBytes = sizeBytes,
        )
    }

    private fun isAllowedImage(document: SelectedImage): Boolean {
        val lowerName = document.displayName.lowercase()
        val validExtension = lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")
        val validMimeType = document.mimeType == "image/png" || document.mimeType == "image/jpeg"
        return validExtension || validMimeType
    }

    private data class ProfilePayload(
        val profile: UserProfile,
        val paymentMethods: List<PaymentMethod>,
        val metrics: Metrics,
        val activeAuction: ActiveAuction?
    )

    private data class SelectedImage(
        val dataUrl: String,
        val displayName: String,
        val mimeType: String,
        val sizeBytes: Long?,
    )

    private companion object {
        const val MAX_AVATAR_SIZE_BYTES = 5L * 1024L * 1024L
    }
}
