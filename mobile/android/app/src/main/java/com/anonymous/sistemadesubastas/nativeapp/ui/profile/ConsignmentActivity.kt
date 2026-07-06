package com.anonymous.sistemadesubastas.nativeapp.ui.profile

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.text.InputType
import android.util.Base64
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import com.anonymous.sistemadesubastas.R
import com.anonymous.sistemadesubastas.databinding.ActivityConsignmentBinding
import com.anonymous.sistemadesubastas.databinding.ItemConsignmentCardBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.Consignment
import com.anonymous.sistemadesubastas.nativeapp.data.repository.ProfileRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.Formatters
import com.anonymous.sistemadesubastas.nativeapp.ui.common.RemoteImageLoader
import org.json.JSONArray
import org.json.JSONObject

class ConsignmentActivity : BaseActivity() {
    private lateinit var binding: ActivityConsignmentBinding
    private val profileRepository by lazy { ProfileRepository(apiClient) }
    private val selectedPhotos = mutableListOf<SelectedPhoto>()

    private val galleryPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                openGallery()
            } else {
                alert(
                    "Permiso denegado",
                    "No podemos enviar la pieza sin acceder a la galeria para cargar las fotos.",
                )
            }
        }

    private val galleryLauncher =
        registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
            if (uris.isNullOrEmpty()) {
                return@registerForActivityResult
            }

            try {
                val loadedPhotos = uris.map { uri ->
                    val photo = readSelectedPhoto(uri)
                    if (!isAllowedImage(photo)) {
                        throw IllegalStateException("Solo se permiten imagenes PNG o JPG para la pieza.")
                    }
                    if (photo.sizeBytes != null && photo.sizeBytes > MAX_PHOTO_SIZE_BYTES) {
                        throw IllegalStateException("Cada foto debe pesar menos de 5 MB.")
                    }
                    photo
                }
                selectedPhotos.clear()
                selectedPhotos.addAll(loadedPhotos)
                renderSelectedPhotos()
            } catch (error: Exception) {
                alert("No se pudieron cargar las fotos", error.message ?: "Intenta nuevamente.")
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }

        binding = ActivityConsignmentBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.backButton.setOnClickListener { finish() }
        binding.selectPhotosButton.setOnClickListener { beginPhotoSelection() }
        binding.submitButton.setOnClickListener { submitConsignment() }

        renderSelectedPhotos()
        loadConsignments()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    private fun loadConsignments() {
        AppExecutors.ioThenMain(
            task = {
                ConsignmentPayload(
                    userConsignments = profileRepository.consignments(),
                    adminConsignments = if (isConsignmentAdmin()) {
                        profileRepository.adminPendingConsignments().filter {
                            it.status.equals("enviada", ignoreCase = true) ||
                                it.status.equals("en_revision", ignoreCase = true)
                        }
                    } else {
                        emptyList()
                    }
                )
            },
            onSuccess = { payload ->
                renderConsignments(payload)
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No se pudieron cargar tus piezas",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun renderConsignments(payload: ConsignmentPayload) {
        binding.consignmentsContainer.removeAllViews()
        val hasAdminItems = payload.adminConsignments.isNotEmpty()
        binding.emptyConsignmentsText.visibility = if (payload.userConsignments.isEmpty() && !hasAdminItems) View.VISIBLE else View.GONE

        if (isConsignmentAdmin()) {
            addSectionLabel("Solicitudes para revisar")
            if (payload.adminConsignments.isEmpty()) {
                addInfoText("No hay solicitudes pendientes.")
            } else {
                payload.adminConsignments.forEach(::addAdminConsignmentCard)
            }
        }

        payload.userConsignments.forEach { consignment ->
            val itemBinding = ItemConsignmentCardBinding.inflate(layoutInflater, binding.consignmentsContainer, false)
            itemBinding.titleText.text = consignment.title
            itemBinding.statusText.text = Formatters.consignmentStatus(consignment.status)
            itemBinding.descriptionText.text = consignment.description
            itemBinding.metaText.text = buildMeta(consignment)
            itemBinding.insuranceButton.visibility = if (consignment.insurancePolicy.isNullOrBlank()) View.GONE else View.VISIBLE
            itemBinding.insuranceButton.setOnClickListener { showInsuranceDetails(consignment) }
            val canDecideProposal = consignment.status.equals(STATUS_PENDING_CONFIRMATION, ignoreCase = true)
            itemBinding.proposalActions.visibility = if (canDecideProposal) View.VISIBLE else View.GONE
            itemBinding.acceptProposalButton.setOnClickListener { decideProposal(consignment, accept = true) }
            itemBinding.rejectProposalButton.setOnClickListener { decideProposal(consignment, accept = false) }
            binding.consignmentsContainer.addView(itemBinding.root)
        }
    }

    private fun addSectionLabel(text: String) {
        val label = TextView(this).apply {
            this.text = text
            setTextColor(ContextCompat.getColor(this@ConsignmentActivity, R.color.atelier_accent))
            textSize = 12f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, 12.dp(), 0, 10.dp())
        }
        binding.consignmentsContainer.addView(label)
    }

    private fun addInfoText(text: String) {
        val label = TextView(this).apply {
            this.text = text
            setTextColor(ContextCompat.getColor(this@ConsignmentActivity, R.color.atelier_text))
            textSize = 14f
            setPadding(0, 0, 0, 12.dp())
        }
        binding.consignmentsContainer.addView(label)
    }

    private fun addAdminConsignmentCard(consignment: Consignment) {
        val itemBinding = ItemConsignmentCardBinding.inflate(layoutInflater, binding.consignmentsContainer, false)
        itemBinding.titleText.text = consignment.title
        itemBinding.statusText.text = "Solicitud"
        itemBinding.descriptionText.text = consignment.description
        itemBinding.metaText.text = buildAdminMeta(consignment)
        itemBinding.insuranceButton.visibility = View.GONE
        itemBinding.proposalActions.visibility = View.VISIBLE
        itemBinding.acceptProposalButton.text = "Aceptar item"
        itemBinding.rejectProposalButton.text = "Rechazar"
        itemBinding.acceptProposalButton.setOnClickListener { reviewAdminConsignment(consignment, accept = true) }
        itemBinding.rejectProposalButton.setOnClickListener { reviewAdminConsignment(consignment, accept = false) }
        addPhotoStrip(itemBinding.root, consignment.photos)
        binding.consignmentsContainer.addView(itemBinding.root)
    }

    private fun addPhotoStrip(container: LinearLayout, photos: List<String>) {
        if (photos.isEmpty()) {
            return
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = 12.dp()
                bottomMargin = 2.dp()
            }
        }
        photos.take(3).forEachIndexed { index, photo ->
            val imageView = ImageView(this).apply {
                scaleType = ImageView.ScaleType.CENTER_CROP
                setBackgroundColor(ContextCompat.getColor(this@ConsignmentActivity, R.color.atelier_surface_soft))
                layoutParams = LinearLayout.LayoutParams(0, 92.dp(), 1f).apply {
                    if (index > 0) {
                        marginStart = 8.dp()
                    }
                }
            }
            RemoteImageLoader.load(imageView, photo)
            row.addView(imageView)
        }
        container.addView(row, 3)
    }

    private fun buildMeta(consignment: Consignment): String {
        val parts = mutableListOf<String>()
        parts += "${consignment.photos.size} fotos"
        if (consignment.itemCount > 1) {
            parts += "${consignment.itemCount} articulos"
        }
        consignment.collectionName?.let { parts += "Coleccion $it" }
        consignment.inspectionAddress?.let { parts += "Enviar a inspeccion: $it" }
        consignment.assignedAuctionTitle?.let { title ->
            val schedule = consignment.assignedAuctionScheduledAt ?: "fecha a confirmar"
            val location = consignment.assignedAuctionLocation ?: "lugar a confirmar"
            parts += "Subasta asignada: $title - $schedule - $location"
        }
        consignment.proposedBasePrice?.let { parts += "Base propuesta ${Formatters.money("USD", it)}" }
        consignment.commissionRate?.let { parts += "Comision $it" }
        consignment.storageLocation?.let { parts += "Deposito: $it" }
        consignment.insurancePolicy?.let { parts += "Poliza: $it" }
        if (consignment.originDoubtReported) {
            parts += "Duda de origen informada a autoridades"
        }
        consignment.originDoubtNotes?.let { parts += "Origen: $it" }
        consignment.returnShippingCost?.let { parts += "Devolucion ${Formatters.money("USD", it)}" }
        consignment.returnShippingNote?.let { parts += it }
        consignment.rejectionReason?.takeIf { it.isNotBlank() }?.let { parts += it }
        return parts.joinToString(" - ")
    }

    private fun buildAdminMeta(consignment: Consignment): String {
        val parts = mutableListOf<String>()
        consignment.story?.let { parts += "Historia: $it" }
        parts += "Cantidad: ${consignment.itemCount}"
        parts += "Fotos: ${consignment.photos.size}"
        parts += "Coleccion: ${consignment.collectionName ?: "No aplica"}"
        parts += "Cuenta de liquidacion: ${consignment.payoutAccount ?: "No declarada aun"}"
        parts += "Evidencia: ${consignment.lawfulOriginEvidence.joinToString().ifBlank { "Sin evidencia adicional declarada." }}"
        consignment.inspectionAddress?.let { parts += "Direccion de revision: $it" }
        return parts.joinToString("\n")
    }

    private fun showInsuranceDetails(consignment: Consignment) {
        alert(
            "Poliza de seguro",
            (
                "Poliza contratada: ${consignment.insurancePolicy}.\n\n" +
                    "Deposito actual: ${consignment.storageLocation ?: "No informado"}.\n\n" +
                    "Si queres aumentar el valor asegurado, comunicate con la compania indicada en la poliza " +
                    "y abona la diferencia del premio correspondiente."
                )
        )
    }

    private fun decideProposal(consignment: Consignment, accept: Boolean) {
        if (accept && consignment.payoutAccount.isNullOrBlank()) {
            promptPayoutAccount(consignment)
            return
        }
        submitProposalDecision(consignment.id, accept, consignment.payoutAccount)
    }

    private fun promptPayoutAccount(consignment: Consignment) {
        val input = EditText(this).apply {
            hint = "CBU, alias, IBAN o cuenta a la vista"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            minLines = 2
            setText(consignment.payoutAccount.orEmpty())
        }
        val dialog = AlertDialog.Builder(this)
            .setTitle("Cuenta de liquidacion")
            .setMessage("Para aceptar la propuesta, declara la cuenta donde se liquidara el resultado de la subasta.")
            .setView(input)
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Aceptar") { _, _ ->
                val payoutAccount = input.text?.toString().orEmpty().trim()
                if (payoutAccount.isBlank()) {
                    alert("Cuenta requerida", "Debes declarar una cuenta antes de aceptar la propuesta.")
                    return@setPositiveButton
                }
                submitProposalDecision(consignment.id, accept = true, payoutAccount = payoutAccount)
            }
            .show()
        styleDialogButtons(dialog)
    }

    private fun submitProposalDecision(consignmentId: Int, accept: Boolean, payoutAccount: String?) {
        setLoading(true)
        AppExecutors.ioThenMain(
            task = { profileRepository.decideConsignmentProposal(consignmentId, accept, payoutAccount) },
            onSuccess = {
                setLoading(false)
                toast(if (accept) "Propuesta aceptada" else "Propuesta rechazada")
                loadConsignments()
            },
            onError = { throwable ->
                setLoading(false)
                showErrorOrHandleSession(
                    title = "No se pudo responder la propuesta",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun reviewAdminConsignment(consignment: Consignment, accept: Boolean) {
        setLoading(true)
        AppExecutors.ioThenMain(
            task = { profileRepository.reviewConsignment(consignment.id, accept) },
            onSuccess = {
                setLoading(false)
                alert(
                    if (accept) "Item aceptado" else "Item rechazado",
                    if (accept) {
                        "Se abrio el chat con el duenio para confirmar fecha, hora, lugar, valor base y comisiones."
                    } else {
                        "El duenio recibio la notificacion de rechazo y la fecha de retorno al punto de retiro."
                    }
                )
                loadConsignments()
            },
            onError = { throwable ->
                setLoading(false)
                showErrorOrHandleSession(
                    title = "No se pudo revisar la solicitud",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun beginPhotoSelection() {
        if (hasGalleryPermission()) {
            openGallery()
        } else {
            galleryPermissionLauncher.launch(requiredGalleryPermission())
        }
    }

    private fun openGallery() {
        galleryLauncher.launch("image/*")
    }

    private fun renderSelectedPhotos() {
        val count = selectedPhotos.size
        binding.photoCountText.text = when {
            count == 0 -> "Necesitas al menos 6 fotos."
            count < 6 -> "Llevas $count fotos. Necesitas al menos 6."
            else -> "Seleccionaste $count fotos listas para enviar."
        }
        binding.selectedPhotosText.text = if (count == 0) {
            "Todavia no cargaste fotos del bien."
        } else {
            selectedPhotos.joinToString(separator = "\n") { it.displayName }
        }
    }

    private fun submitConsignment() {
        val title = binding.titleInput.text?.toString().orEmpty().trim()
        val description = binding.descriptionInput.text?.toString().orEmpty().trim()
        val story = binding.storyInput.text?.toString().orEmpty().trim()
        val itemCountText = binding.itemCountInput.text?.toString().orEmpty().trim()
        val itemCount = itemCountText.toIntOrNull() ?: 1
        val collectionName = binding.collectionNameInput.text?.toString().orEmpty().trim()
        val payoutAccount = binding.payoutAccountInput.text?.toString().orEmpty().trim()
        val lawfulOriginEvidence = binding.lawfulOriginEvidenceInput.text?.toString().orEmpty()
            .split(',', '\n')
            .map { it.trim() }
            .filter { it.isNotBlank() }

        if (title.isBlank()) {
            alert("Titulo requerido", "Ingresa un titulo para la pieza.")
            return
        }
        if (description.isBlank()) {
            alert("Descripcion requerida", "Ingresa una descripcion para la pieza.")
            return
        }
        if (selectedPhotos.size < 6) {
            alert("Fotos insuficientes", "Debes cargar al menos 6 fotos del bien.")
            return
        }
        if (itemCount < 1) {
            alert("Cantidad invalida", "La cantidad de articulos debe ser al menos 1.")
            return
        }
        if (!binding.ownershipCheck.isChecked || !binding.legalOriginCheck.isChecked || !binding.returnChargeCheck.isChecked) {
            alert(
                "Declaraciones requeridas",
                "Debes declarar titularidad, origen licito y aceptacion de devolucion con cargo para continuar.",
            )
            return
        }

        val payload = JSONObject()
            .put("title", title)
            .put("description", description)
            .put("story", story.takeIf { it.isNotBlank() })
            .put("photos", JSONArray(selectedPhotos.map { it.dataUrl }))
            .put("declared_ownership", true)
            .put("declared_legal_origin", true)
            .put("declared_return_charge_agreement", true)
            .put("lawful_origin_evidence", JSONArray(lawfulOriginEvidence))
            .put("item_count", itemCount)

        if (collectionName.isNotBlank()) {
            payload.put("collection_name", collectionName)
        }
        if (payoutAccount.isNotBlank()) {
            payload.put("payout_account", payoutAccount)
        }

        setLoading(true)
        AppExecutors.ioThenMain(
            task = { profileRepository.createConsignment(payload) },
            onSuccess = {
                setLoading(false)
                alert(
                    "Pieza enviada",
                    "Debes dejar el item en la direccion Av. Santa Fe 3858 dentro de los proximos 3 dias habiles para su revision."
                )
                clearForm()
                loadConsignments()
            },
            onError = { throwable ->
                setLoading(false)
                showErrorOrHandleSession(
                    title = "No se pudo enviar la pieza",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun clearForm() {
        binding.titleInput.text?.clear()
        binding.descriptionInput.text?.clear()
        binding.storyInput.text?.clear()
        binding.itemCountInput.text?.clear()
        binding.collectionNameInput.text?.clear()
        binding.payoutAccountInput.text?.clear()
        binding.lawfulOriginEvidenceInput.text?.clear()
        binding.ownershipCheck.isChecked = false
        binding.legalOriginCheck.isChecked = false
        binding.returnChargeCheck.isChecked = false
        selectedPhotos.clear()
        renderSelectedPhotos()
    }

    private fun setLoading(isLoading: Boolean) {
        binding.submitButton.isEnabled = !isLoading
        binding.submitButton.text = if (isLoading) "Enviando..." else "Enviar a evaluacion"
    }

    private fun readSelectedPhoto(uri: Uri): SelectedPhoto {
        val mimeType = contentResolver.getType(uri).orEmpty()
        val bytes = contentResolver.openInputStream(uri)?.use { input -> input.readBytes() }
            ?: throw IllegalStateException("No pudimos leer el archivo seleccionado.")

        val dataUrl = "data:${if (mimeType.isBlank()) "image/jpeg" else mimeType};base64,${
            Base64.encodeToString(bytes, Base64.NO_WRAP)
        }"

        var displayName = "pieza.jpg"
        var sizeBytes: Long? = bytes.size.toLong()
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (nameIndex >= 0) {
                        displayName = cursor.getString(nameIndex) ?: displayName
                    }
                    if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
                        sizeBytes = cursor.getLong(sizeIndex)
                    }
                }
            }

        return SelectedPhoto(
            dataUrl = dataUrl,
            displayName = displayName,
            mimeType = mimeType,
            sizeBytes = sizeBytes
        )
    }

    private fun isAllowedImage(photo: SelectedPhoto): Boolean {
        val lowerName = photo.displayName.lowercase()
        val validExtension = lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")
        val validMimeType = photo.mimeType == "image/png" || photo.mimeType == "image/jpeg"
        return validExtension || validMimeType
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

    private data class SelectedPhoto(
        val dataUrl: String,
        val displayName: String,
        val mimeType: String,
        val sizeBytes: Long?
    )

    private data class ConsignmentPayload(
        val userConsignments: List<Consignment>,
        val adminConsignments: List<Consignment>,
    )

    companion object {
        private const val MAX_PHOTO_SIZE_BYTES = 5L * 1024L * 1024L
        private const val STATUS_PENDING_CONFIRMATION = "pendiente_confirmacion"
        private const val CONSIGNMENT_ADMIN_EMAIL = "m@gmail.com"
    }

    private fun isConsignmentAdmin(): Boolean {
        return sessionManager.userSnapshot()?.email?.trim()?.lowercase() == CONSIGNMENT_ADMIN_EMAIL
    }

    private fun Int.dp(): Int = (this * resources.displayMetrics.density).toInt()
}
