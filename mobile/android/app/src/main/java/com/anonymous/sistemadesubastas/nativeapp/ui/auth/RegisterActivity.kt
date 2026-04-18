package com.anonymous.sistemadesubastas.nativeapp.ui.auth

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Base64
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import com.anonymous.sistemadesubastas.databinding.ActivityRegisterBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.network.ApiClient
import com.anonymous.sistemadesubastas.nativeapp.data.repository.AuthRepository
import com.anonymous.sistemadesubastas.nativeapp.data.repository.ProfileRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.home.HomeActivity
import org.json.JSONObject

class RegisterActivity : BaseActivity() {
    private lateinit var binding: ActivityRegisterBinding
    private val authRepository by lazy { AuthRepository(apiClient) }

    private val countryOptions = listOf(
        SelectOption("Argentina", 32),
        SelectOption("Reino Unido", 826),
        SelectOption("Estados Unidos", 840),
        SelectOption("Suiza", 756),
        SelectOption("Francia", 250)
    )
    private val paymentTypeOptions = listOf(
        SelectOption("Tarjeta de credito", PAYMENT_CARD),
        SelectOption("Cuenta bancaria", PAYMENT_BANK),
        SelectOption("Cheque certificado", PAYMENT_CHECK)
    )
    private val currencyOptions = listOf(
        SelectOption("Pesos argentinos (ARS)", "ARS"),
        SelectOption("Dolares estadounidenses (USD)", "USD")
    )
    private val bankOptions = listOf(
        SelectOption("Galicia", "Galicia"),
        SelectOption("Macro", "Macro"),
        SelectOption("BNA", "BNA"),
        SelectOption("Santander", "Santander"),
        SelectOption("BBVA", "BBVA"),
        SelectOption("Patagonia", "Patagonia"),
        SelectOption("Banco Provincia", "Banco Provincia"),
        SelectOption("ICBC", "ICBC"),
        SelectOption("HSBC", "HSBC"),
        SelectOption("Ciudad", "Ciudad")
    )

    private var selectedCountry = countryOptions.first()
    private var selectedPaymentType = paymentTypeOptions.first()
    private var selectedCurrency = currencyOptions.first()
    private var selectedBank = bankOptions.first()
    private var frontDocument: SelectedDocument? = null
    private var backDocument: SelectedDocument? = null
    private var pendingDocumentSide: DocumentSide? = null

    private val galleryPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                openGalleryForPendingSide()
            } else {
                alert(
                    "Permiso denegado",
                    "No podemos completar el registro sin poder acceder a la galeria para adjuntar el DNI."
                )
            }
        }

    private val galleryLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            val side = pendingDocumentSide ?: return@registerForActivityResult
            if (uri == null) {
                pendingDocumentSide = null
                return@registerForActivityResult
            }

            try {
                val document = readSelectedDocument(uri)
                if (!isAllowedImage(document)) {
                    alert("Formato no valido", "Solo se permiten imagenes PNG o JPG para el DNI.")
                    return@registerForActivityResult
                }
                if (document.sizeBytes != null && document.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
                    alert("Archivo demasiado grande", "Cada imagen del DNI debe pesar menos de 5 MB.")
                    return@registerForActivityResult
                }

                when (side) {
                    DocumentSide.FRONT -> frontDocument = document
                    DocumentSide.BACK -> backDocument = document
                }
                updateDocumentUi()
            } catch (error: Exception) {
                alert("No se pudo adjuntar", error.message ?: "No pudimos leer la imagen seleccionada.")
            } finally {
                pendingDocumentSide = null
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (sessionManager.isLoggedIn()) {
            startActivity(Intent(this, HomeActivity::class.java))
            finish()
            return
        }

        binding = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.backButton.setOnClickListener { finish() }
        binding.countryValue.setOnClickListener { showSelector("Pais de origen", countryOptions, selectedCountry) { option ->
            selectedCountry = option
            binding.countryValue.text = option.label
        } }
        binding.paymentTypeValue.setOnClickListener { showSelector("Medio de pago", paymentTypeOptions, selectedPaymentType) { option ->
            selectedPaymentType = option
            binding.paymentTypeValue.text = option.label
            updatePaymentUi()
        } }
        binding.currencyValue.setOnClickListener { showSelector("Moneda", currencyOptions, selectedCurrency) { option ->
            selectedCurrency = option
            binding.currencyValue.text = option.label
        } }
        binding.bankValue.setOnClickListener { showSelector("Banco emisor", bankOptions, selectedBank) { option ->
            selectedBank = option
            binding.bankValue.text = option.label
        } }
        binding.documentFrontButton.setOnClickListener { beginDocumentSelection(DocumentSide.FRONT) }
        binding.documentBackButton.setOnClickListener { beginDocumentSelection(DocumentSide.BACK) }
        binding.cardNumberInput.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus && binding.cardNumberInput.text?.isNotBlank() == true) {
                val digits = keepNumeric(binding.cardNumberInput.text.toString())
                if (digits.length != 16) {
                    alert("Numero de tarjeta invalido", "El numero de tarjeta debe tener exactamente 16 digitos.")
                }
            }
        }
        binding.expirationDateInput.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) {
                binding.expirationDateInput.setText(formatExpirationDate(binding.expirationDateInput.text?.toString().orEmpty()))
            }
        }
        binding.submitButton.setOnClickListener { submitRegistration() }

        binding.countryValue.text = selectedCountry.label
        binding.paymentTypeValue.text = selectedPaymentType.label
        binding.currencyValue.text = selectedCurrency.label
        binding.bankValue.text = selectedBank.label
        updateDocumentUi()
        updatePaymentUi()
    }

    private fun submitRegistration() {
        val firstName = removeDigits(binding.firstNameInput.text?.toString().orEmpty()).trim()
        val lastName = removeDigits(binding.lastNameInput.text?.toString().orEmpty()).trim()
        val email = binding.emailInput.text?.toString().orEmpty().trim().lowercase()
        val street = removeDigits(binding.streetInput.text?.toString().orEmpty()).trim()
        val number = keepNumeric(binding.numberInput.text?.toString().orEmpty())
        val city = removeDigits(binding.cityInput.text?.toString().orEmpty()).trim()
        val region = removeDigits(binding.regionInput.text?.toString().orEmpty()).trim()
        val postalCode = binding.postalCodeInput.text?.toString().orEmpty().trim()
        val cardNumber = keepNumeric(binding.cardNumberInput.text?.toString().orEmpty())
        val securityCode = keepNumeric(binding.securityCodeInput.text?.toString().orEmpty())
        val expirationDate = formatExpirationDate(binding.expirationDateInput.text?.toString().orEmpty())
        val checkAmount = keepNumeric(binding.checkAmountInput.text?.toString().orEmpty())
        val password = binding.passwordInput.text?.toString().orEmpty()
        val confirmPassword = binding.confirmPasswordInput.text?.toString().orEmpty()

        if (firstName.isBlank() || lastName.isBlank() || email.isBlank() || street.isBlank() || number.isBlank() || city.isBlank() || region.isBlank() || postalCode.isBlank()) {
            alert("Faltan datos", "Completa todos los campos obligatorios antes de continuar.")
            return
        }
        if (!isValidEmail(email)) {
            alert("Mail invalido", "Ingresa un correo electronico valido que contenga @.")
            return
        }
        if (frontDocument == null || backDocument == null) {
            alert("DNI requerido", "Debes adjuntar frente y dorso del DNI para completar el registro.")
            return
        }
        if (password.length < 6) {
            alert("Contrasena demasiado corta", "La contrasena debe tener al menos 6 caracteres.")
            return
        }
        if (password != confirmPassword) {
            alert("Contrasenas distintas", "La confirmacion no coincide con la contrasena ingresada.")
            return
        }

        when (selectedPaymentType.value) {
            PAYMENT_CARD -> {
                if (cardNumber.length != 16) {
                    alert("Numero de tarjeta invalido", "El numero de tarjeta debe tener exactamente 16 digitos.")
                    return
                }
                if (securityCode.length != 3) {
                    alert("Codigo de seguridad invalido", "Ingresa un codigo de seguridad de 3 digitos.")
                    return
                }
                if (!isValidExpirationDate(expirationDate)) {
                    alert("Vencimiento invalido", "Ingresa la fecha de vencimiento con formato MM/AA.")
                    return
                }
            }

            PAYMENT_CHECK -> {
                if (checkAmount.isBlank() || checkAmount.toDoubleOrNull() == null || checkAmount.toDouble() <= 0) {
                    alert("Monto invalido", "Ingresa un monto valido para el cheque certificado.")
                    return
                }
            }
        }

        val legalAddress = "$street $number, $city, $region, $postalCode"
        val paymentPayload = buildPaymentPayload(
            firstName = firstName,
            lastName = lastName,
            cardNumber = cardNumber,
            expirationDate = expirationDate,
            checkAmount = checkAmount
        )

        setSubmitting(true)
        AppExecutors.ioThenMain(
            task = {
                val userId = authRepository.preRegister(
                    email = email,
                    firstName = firstName,
                    lastName = lastName,
                    legalAddress = legalAddress,
                    countryCode = selectedCountry.value,
                    documentFrontImage = frontDocument!!.dataUrl,
                    documentBackImage = backDocument!!.dataUrl
                )
                val auth = authRepository.completeRegistration(userId, password)
                val onboardingProfileRepository = ProfileRepository(ApiClient { auth.accessToken })
                onboardingProfileRepository.createPaymentMethod(paymentPayload)
                val profile = onboardingProfileRepository.profile()
                RegistrationResult(auth.accessToken, profile)
            },
            onSuccess = { result ->
                sessionManager.saveSession(result.accessToken, result.profile)
                setSubmitting(false)
                startActivity(
                    Intent(this, HomeActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                finish()
            },
            onError = { throwable ->
                setSubmitting(false)
                alert("No se pudo completar el registro", throwable.message ?: "Intenta de nuevo en unos instantes.")
            }
        )
    }

    private fun beginDocumentSelection(side: DocumentSide) {
        pendingDocumentSide = side
        AlertDialog.Builder(this)
            .setTitle("Acceso a la galeria")
            .setMessage("CURATOR necesita acceder a tu galeria para adjuntar las fotos del frente y dorso del DNI.")
            .setNegativeButton("Cancelar") { dialog, _ ->
                dialog.dismiss()
                pendingDocumentSide = null
            }
            .setPositiveButton("Continuar") { dialog, _ ->
                dialog.dismiss()
                if (hasGalleryPermission()) {
                    openGalleryForPendingSide()
                } else {
                    galleryPermissionLauncher.launch(requiredGalleryPermission())
                }
            }
            .show()
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

    private fun openGalleryForPendingSide() {
        if (pendingDocumentSide != null) {
            galleryLauncher.launch("image/*")
        }
    }

    private fun readSelectedDocument(uri: Uri): SelectedDocument {
        val mimeType = contentResolver.getType(uri).orEmpty()
        val bytes = contentResolver.openInputStream(uri)?.use { input -> input.readBytes() }
            ?: throw IllegalStateException("No pudimos leer el archivo seleccionado.")
        val dataUrl = "data:${if (mimeType.isBlank()) "image/jpeg" else mimeType};base64,${
            Base64.encodeToString(bytes, Base64.NO_WRAP)
        }"

        var displayName = "documento.jpg"
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

        return SelectedDocument(
            dataUrl = dataUrl,
            displayName = displayName,
            mimeType = mimeType,
            sizeBytes = sizeBytes
        )
    }

    private fun <T> showSelector(
        title: String,
        options: List<SelectOption<T>>,
        selected: SelectOption<T>,
        onSelected: (SelectOption<T>) -> Unit
    ) {
        val labels = options.map { it.label }.toTypedArray()
        val selectedIndex = options.indexOfFirst { it.value == selected.value }.coerceAtLeast(0)
        AlertDialog.Builder(this)
            .setTitle(title)
            .setSingleChoiceItems(labels, selectedIndex) { dialog, which ->
                onSelected(options[which])
                dialog.dismiss()
            }
            .show()
    }

    private fun updateDocumentUi() {
        binding.documentFrontStatus.text = frontDocument?.displayName ?: "Frente pendiente"
        binding.documentBackStatus.text = backDocument?.displayName ?: "Dorso pendiente"
        binding.documentSummary.text = if (frontDocument != null && backDocument != null) {
            "Documento adjuntado"
        } else {
            "Debes cargar frente y dorso en PNG o JPG"
        }
    }

    private fun updatePaymentUi() {
        val paymentType = selectedPaymentType.value
        binding.paymentTypeValue.text = selectedPaymentType.label
        binding.currencyValue.text = selectedCurrency.label
        binding.bankValue.text = selectedBank.label

        binding.cardFieldsGroup.visibility = if (paymentType == PAYMENT_CARD) View.VISIBLE else View.GONE
        binding.currencyFieldGroup.visibility = if (paymentType == PAYMENT_BANK || paymentType == PAYMENT_CHECK) View.VISIBLE else View.GONE
        binding.bankFieldGroup.visibility = if (paymentType == PAYMENT_BANK) View.VISIBLE else View.GONE
        binding.checkAmountGroup.visibility = if (paymentType == PAYMENT_CHECK) View.VISIBLE else View.GONE
    }

    private fun buildPaymentPayload(
        firstName: String,
        lastName: String,
        cardNumber: String,
        expirationDate: String,
        checkAmount: String
    ): JSONObject {
        val fullName = listOf(firstName, lastName).joinToString(" ").trim()
        return when (selectedPaymentType.value) {
            PAYMENT_CARD -> JSONObject()
                .put("type", PAYMENT_CARD)
                .put("display_name", "Tarjeta de credito de $fullName")
                .put("currency", "ARS")
                .put("issuer_country", "AR")
                .put("available_amount", defaultAvailableAmount("ARS"))
                .put("last_four", cardNumber.takeLast(4))
                .put("holder_first_name", firstName)
                .put("holder_last_name", lastName)
                .put("expiration_date", expirationDate)

            PAYMENT_BANK -> JSONObject()
                .put("type", PAYMENT_BANK)
                .put("display_name", "Cuenta ${selectedBank.label} de $fullName")
                .put("currency", selectedCurrency.value)
                .put("issuer_country", "AR")
                .put("available_amount", defaultAvailableAmount(selectedCurrency.value))
                .put("holder_first_name", firstName)
                .put("holder_last_name", lastName)
                .put("issuing_bank", selectedBank.value)

            else -> JSONObject()
                .put("type", PAYMENT_CHECK)
                .put("display_name", "Cheque certificado de $fullName")
                .put("currency", selectedCurrency.value)
                .put("issuer_country", "AR")
                .put("available_amount", checkAmount.toDouble())
                .put("holder_first_name", firstName)
                .put("holder_last_name", lastName)
        }
    }

    private fun setSubmitting(isSubmitting: Boolean) {
        binding.submitButton.isEnabled = !isSubmitting
        binding.submitButton.text = if (isSubmitting) "Registrando..." else "Crear cuenta"
    }

    private fun isValidEmail(value: String): Boolean {
        return value.contains("@") && EMAIL_REGEX.matches(value)
    }

    private fun isAllowedImage(document: SelectedDocument): Boolean {
        val lowerName = document.displayName.lowercase()
        val validExtension = lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")
        val validMimeType = document.mimeType == "image/png" || document.mimeType == "image/jpeg"
        return validExtension || validMimeType
    }

    private fun formatExpirationDate(value: String): String {
        val digits = keepNumeric(value).take(4)
        return if (digits.length <= 2) digits else "${digits.take(2)}/${digits.drop(2)}"
    }

    private fun isValidExpirationDate(value: String): Boolean {
        return EXPIRATION_REGEX.matches(value)
    }

    private fun keepNumeric(value: String): String = value.replace(NON_DIGITS_REGEX, "")

    private fun removeDigits(value: String): String = value.replace(DIGITS_REGEX, "")

    private fun defaultAvailableAmount(currency: String): Double = if (currency == "USD") 25000.0 else 5_000_000.0

    private data class SelectOption<T>(
        val label: String,
        val value: T
    )

    private data class SelectedDocument(
        val dataUrl: String,
        val displayName: String,
        val mimeType: String,
        val sizeBytes: Long?
    )

    private data class RegistrationResult(
        val accessToken: String,
        val profile: com.anonymous.sistemadesubastas.nativeapp.data.model.UserProfile
    )

    private enum class DocumentSide {
        FRONT,
        BACK
    }

    private companion object {
        const val PAYMENT_CARD = "tarjeta_credito"
        const val PAYMENT_BANK = "cuenta_bancaria"
        const val PAYMENT_CHECK = "cheque_certificado"
        const val MAX_DOCUMENT_SIZE_BYTES = 5L * 1024L * 1024L
        val DIGITS_REGEX = Regex("\\d+")
        val NON_DIGITS_REGEX = Regex("[^0-9]")
        val EMAIL_REGEX = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
        val EXPIRATION_REGEX = Regex("^(0[1-9]|1[0-2])/\\d{2}$")
    }
}
