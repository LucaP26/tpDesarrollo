package com.anonymous.sistemadesubastas.nativeapp.ui.profile

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Base64
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.anonymous.sistemadesubastas.databinding.ActivityConsignmentBinding
import com.anonymous.sistemadesubastas.databinding.ItemConsignmentCardBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.Consignment
import com.anonymous.sistemadesubastas.nativeapp.data.repository.ProfileRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.Formatters
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
            task = { profileRepository.consignments() },
            onSuccess = { consignments ->
                renderConsignments(consignments)
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

    private fun renderConsignments(consignments: List<Consignment>) {
        binding.consignmentsContainer.removeAllViews()
        binding.emptyConsignmentsText.visibility = if (consignments.isEmpty()) View.VISIBLE else View.GONE

        consignments.forEach { consignment ->
            val itemBinding = ItemConsignmentCardBinding.inflate(layoutInflater, binding.consignmentsContainer, false)
            itemBinding.titleText.text = consignment.title
            itemBinding.statusText.text = Formatters.consignmentStatus(consignment.status)
            itemBinding.descriptionText.text = consignment.description
            itemBinding.metaText.text = buildMeta(consignment)
            binding.consignmentsContainer.addView(itemBinding.root)
        }
    }

    private fun buildMeta(consignment: Consignment): String {
        val parts = mutableListOf<String>()
        parts += "${consignment.photos.size} fotos"
        consignment.proposedBasePrice?.let { parts += "Base propuesta ${Formatters.money("USD", it)}" }
        consignment.rejectionReason?.takeIf { it.isNotBlank() }?.let { parts += it }
        return parts.joinToString(" - ")
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
        if (!binding.ownershipCheck.isChecked || !binding.legalOriginCheck.isChecked) {
            alert("Declaraciones requeridas", "Debes declarar titularidad y origen licito para continuar.")
            return
        }

        val payload = JSONObject()
            .put("title", title)
            .put("description", description)
            .put("story", story.takeIf { it.isNotBlank() })
            .put("photos", JSONArray(selectedPhotos.map { it.dataUrl }))
            .put("declared_ownership", true)
            .put("declared_legal_origin", true)

        setLoading(true)
        AppExecutors.ioThenMain(
            task = { profileRepository.createConsignment(payload) },
            onSuccess = {
                setLoading(false)
                toast("Pieza enviada a evaluacion")
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
        binding.ownershipCheck.isChecked = false
        binding.legalOriginCheck.isChecked = false
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

    companion object {
        private const val MAX_PHOTO_SIZE_BYTES = 5L * 1024L * 1024L
    }
}
