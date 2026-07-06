package com.anonymous.sistemadesubastas.nativeapp.ui.auth

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.text.InputFilter
import android.text.InputType
import android.util.Base64
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import com.anonymous.sistemadesubastas.databinding.ActivityRegisterBinding
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.text.Collator
import java.util.Calendar
import java.util.Locale

class RegisterActivity : BaseActivity() {
    private lateinit var binding: ActivityRegisterBinding

    private val countryOptions: List<CountryOption> by lazy { buildCountryOptions() }
    private val paymentTypeOptions = listOf(
        SelectOption("Tarjeta de credito", PAYMENT_CARD),
        SelectOption("Cuenta bancaria", PAYMENT_BANK),
        SelectOption("Cheque certificado", PAYMENT_CHECK),
    )
    private val currencyOptions = listOf(
        SelectOption("Pesos argentinos (ARS)", "ARS"),
        SelectOption("Dolares estadounidenses (USD)", "USD"),
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
        SelectOption("Ciudad", "Ciudad"),
    )
    private val cardBrandOptions = listOf(
        SelectOption("American Express", "American Express"),
        SelectOption("Visa", "Visa"),
        SelectOption("Mastercard", "Mastercard"),
    )
    private val genderOptions = listOf(
        SelectOption("Femenino", "femenino"),
        SelectOption("Masculino", "masculino"),
        SelectOption("Otro", "otro"),
    )

    private lateinit var selectedCountry: CountryOption
    private var selectedPaymentType = paymentTypeOptions.first()
    private var selectedCurrency = currencyOptions.first()
    private var selectedBank = bankOptions.first()
    private var selectedCardBrand = cardBrandOptions.first()
    private var selectedGender: SelectOption<String>? = null
    private var selectedBirthDate: LocalDate? = null
    private var selectedExpirationDate: LocalDate? = null
    private var frontDocument: SelectedDocument? = null
    private var backDocument: SelectedDocument? = null
    private var pendingDocumentSide: DocumentSide? = null

    private val lettersOnlyFilter = InputFilter { source, _, _, _, _, _ ->
        if (source == null) {
            return@InputFilter null
        }
        val filtered = source.filter { character ->
            character.isLetter() || character.isWhitespace() || character == '\'' || character == '-' || character == '.'
        }
        if (filtered == source.toString()) null else filtered
    }

    private val galleryPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                openGalleryForPendingSide()
            } else {
                alert(
                    "Permiso denegado",
                    "No podemos completar el registro sin acceder a la galeria para adjuntar el DNI.",
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
        binding = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(binding.root)

        selectedCountry = countryOptions.firstOrNull() ?: CountryOption("Argentina", encodeCountryCode("AR"), "AR")

        binding.backButton.setOnClickListener { finish() }
        binding.countryValue.setOnClickListener {
            showCountrySelector()
        }
        binding.genderValue.setOnClickListener {
            showSelector("Genero", genderOptions, selectedGender) { option ->
                selectedGender = option
                binding.genderValue.text = option.label
            }
        }
        binding.birthDateValue.setOnClickListener {
            showBirthDatePicker()
        }
        binding.paymentTypeValue.setOnClickListener {
            showSelector("Medio de pago", paymentTypeOptions, selectedPaymentType) { option ->
                selectedPaymentType = option
                binding.paymentTypeValue.text = option.label
                updatePaymentUi()
            }
        }
        binding.currencyValue.setOnClickListener {
            showSelector("Moneda", currencyOptions, selectedCurrency) { option ->
                selectedCurrency = option
                binding.currencyValue.text = option.label
            }
        }
        binding.bankValue.setOnClickListener {
            showSelector("Banco emisor", bankOptions, selectedBank) { option ->
                selectedBank = option
                binding.bankValue.text = option.label
            }
        }
        binding.cardBrandValue.setOnClickListener {
            showSelector("Marca de la tarjeta", cardBrandOptions, selectedCardBrand) { option ->
                selectedCardBrand = option
                binding.cardBrandValue.text = option.label
            }
        }
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
        binding.expirationDateInput.setOnClickListener {
            showExpirationDatePicker()
        }
        binding.submitButton.setOnClickListener { submitRegistration() }

        applyInputRules()
        binding.countryValue.text = selectedCountry.label
        binding.paymentTypeValue.text = selectedPaymentType.label
        binding.currencyValue.text = selectedCurrency.label
        binding.bankValue.text = selectedBank.label
        binding.cardBrandValue.text = selectedCardBrand.label
        binding.genderValue.text = "Selecciona tu genero"
        binding.birthDateValue.text = "Selecciona tu fecha de nacimiento"
        binding.expirationDateInput.text = "Selecciona la fecha de vencimiento"
        updateDocumentUi()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    override fun shouldRequestMobileDataConsent(): Boolean = false

    private fun applyInputRules() {
        binding.firstNameInput.filters = arrayOf(lettersOnlyFilter)
        binding.lastNameInput.filters = arrayOf(lettersOnlyFilter)
        binding.cityInput.filters = arrayOf(lettersOnlyFilter)
        binding.regionInput.filters = arrayOf(lettersOnlyFilter)
        binding.cardNumberInput.inputType = InputType.TYPE_CLASS_NUMBER
        binding.cardNumberInput.filters = arrayOf(InputFilter.LengthFilter(16))
    }

    private fun submitRegistration() {
        val firstName = binding.firstNameInput.text?.toString().orEmpty().trim()
        val lastName = binding.lastNameInput.text?.toString().orEmpty().trim()
        val email = binding.emailInput.text?.toString().orEmpty().trim().lowercase()
        val documentNumber = binding.documentNumberInput.text?.toString().orEmpty().trim()
        val gender = selectedGender?.value
        val birthDate = selectedBirthDate
        val street = binding.streetInput.text?.toString().orEmpty().trim()
        val number = binding.numberInput.text?.toString().orEmpty().trim()
        val city = binding.cityInput.text?.toString().orEmpty().trim()
        val region = binding.regionInput.text?.toString().orEmpty().trim()
        val postalCode = binding.postalCodeInput.text?.toString().orEmpty().trim()

        if (
            firstName.isBlank() ||
            lastName.isBlank() ||
            email.isBlank() ||
            documentNumber.isBlank() ||
            gender.isNullOrBlank() ||
            birthDate == null ||
            street.isBlank() ||
            number.isBlank() ||
            city.isBlank() ||
            region.isBlank() ||
            postalCode.isBlank()
        ) {
            alert("Faltan datos", "Completa todos los campos obligatorios antes de continuar.")
            return
        }
        if (!isValidEmail(email)) {
            alert("Mail invalido", "Ingresa un correo electronico valido que contenga @.")
            return
        }
        if (!isLegalAdult(birthDate)) {
            alert("Acceso restringido", "Solo las personas mayores de 18 anos pueden acceder al sitio.")
            return
        }
        if (frontDocument == null || backDocument == null) {
            alert("DNI requerido", "Debes adjuntar frente y dorso del DNI para completar el registro.")
            return
        }

        val legalAddress = "$street $number, $city, $region, $postalCode"

        PendingRegistrationSubmissionStore.current = PendingRegistrationSubmission(
            email = email,
            documentNumber = documentNumber,
            firstName = firstName,
            lastName = lastName,
            gender = gender,
            birthDateIso = birthDate.toString(),
            legalAddress = legalAddress,
            countryCode = selectedCountry.value,
            countryIsoCode = selectedCountry.isoCode,
            documentFrontImage = frontDocument!!.dataUrl,
            documentBackImage = backDocument!!.dataUrl,
        )
        startActivity(Intent(this, RegistrationVerificationActivity::class.java))
    }

    private fun beginDocumentSelection(side: DocumentSide) {
        pendingDocumentSide = side
        if (hasGalleryPermission()) {
            openGalleryForPendingSide()
        } else {
            galleryPermissionLauncher.launch(requiredGalleryPermission())
        }
    }

    private fun showBirthDatePicker() {
        val initialDate = selectedBirthDate ?: LocalDate.now().minusYears(18)
        val calendar = Calendar.getInstance().apply {
            set(initialDate.year, initialDate.monthValue - 1, initialDate.dayOfMonth)
        }

        val picker = android.app.DatePickerDialog(
            this,
            { _, year, month, dayOfMonth ->
                selectedBirthDate = LocalDate.of(year, month + 1, dayOfMonth)
                binding.birthDateValue.text = selectedBirthDate?.format(DISPLAY_DATE_FORMAT)
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH),
        )
        picker.datePicker.maxDate = System.currentTimeMillis()
        styleDatePickerButtons(picker)
        picker.show()
    }

    private fun showExpirationDatePicker() {
        val initialDate = selectedExpirationDate ?: LocalDate.now()
        val calendar = Calendar.getInstance().apply {
            set(initialDate.year, initialDate.monthValue - 1, initialDate.dayOfMonth)
        }

        val picker = android.app.DatePickerDialog(
            this,
            { _, year, month, _ ->
                selectedExpirationDate = LocalDate.of(year, month + 1, 1)
                binding.expirationDateInput.text = selectedExpirationDate?.format(EXPIRATION_DISPLAY_FORMAT)
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH),
        )
        picker.datePicker.minDate = System.currentTimeMillis()
        styleDatePickerButtons(picker)
        picker.show()
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
            sizeBytes = sizeBytes,
        )
    }

    private fun showCountrySelector() {
        val labels = countryOptions.map { it.label }.toTypedArray()
        val selectedIndex = countryOptions.indexOfFirst { it.isoCode == selectedCountry.isoCode }.coerceAtLeast(0)
        AlertDialog.Builder(this)
            .setTitle("Pais de origen")
            .setSingleChoiceItems(labels, selectedIndex) { dialog, which ->
                selectedCountry = countryOptions[which]
                binding.countryValue.text = selectedCountry.label
                dialog.dismiss()
            }
            .show()
    }

    private fun <T> showSelector(
        title: String,
        options: List<SelectOption<T>>,
        selected: SelectOption<T>?,
        onSelected: (SelectOption<T>) -> Unit,
    ) {
        val labels = options.map { it.label }.toTypedArray()
        val selectedIndex = selected?.let { current ->
            options.indexOfFirst { it.value == current.value }.coerceAtLeast(0)
        } ?: -1
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
            "Debes cargar frente y dorso del DNI en PNG o JPG"
        }
    }

    private fun updatePaymentUi() {
        val paymentType = selectedPaymentType.value
        binding.paymentTypeValue.text = selectedPaymentType.label
        binding.currencyValue.text = selectedCurrency.label
        binding.bankValue.text = selectedBank.label
        binding.cardBrandValue.text = selectedCardBrand.label

        binding.cardFieldsGroup.visibility = if (paymentType == PAYMENT_CARD) View.VISIBLE else View.GONE
        binding.currencyFieldGroup.visibility =
            if (paymentType == PAYMENT_BANK || paymentType == PAYMENT_CHECK) View.VISIBLE else View.GONE
        binding.bankFieldGroup.visibility = if (paymentType == PAYMENT_BANK) View.VISIBLE else View.GONE
        binding.checkAmountGroup.visibility = if (paymentType == PAYMENT_CHECK) View.VISIBLE else View.GONE
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

    private fun styleDatePickerButtons(dialog: android.app.DatePickerDialog) {
        dialog.setOnShowListener {
            val color = ContextCompat.getColor(this, com.anonymous.sistemadesubastas.R.color.atelier_action)
            dialog.getButton(android.app.DatePickerDialog.BUTTON_POSITIVE)?.setTextColor(color)
            dialog.getButton(android.app.DatePickerDialog.BUTTON_NEGATIVE)?.setTextColor(color)
        }
    }

    private fun formatExpirationDate(value: String): String {
        val digits = keepNumeric(value).take(4)
        return if (digits.length <= 2) digits else "${digits.take(2)}/${digits.drop(2)}"
    }

    private fun isValidExpirationDate(value: String): Boolean {
        return EXPIRATION_REGEX.matches(value)
    }

    private fun isLegalAdult(value: LocalDate?): Boolean {
        value ?: return false
        return !value.isAfter(LocalDate.now().minusYears(18))
    }

    private fun keepNumeric(value: String): String = value.replace(NON_DIGITS_REGEX, "")

    private fun buildCountryOptions(): List<CountryOption> {
        val spanishLocale = Locale("es")
        val collator = Collator.getInstance(spanishLocale)
        return Locale.getISOCountries()
            .mapNotNull { isoCode ->
                val label = Locale("", isoCode).getDisplayCountry(spanishLocale).trim()
                if (label.isBlank()) {
                    null
                } else {
                    CountryOption(
                        label = label.replaceFirstChar { if (it.isLowerCase()) it.titlecase(spanishLocale) else it.toString() },
                        value = encodeCountryCode(isoCode),
                        isoCode = isoCode,
                    )
                }
            }
            .distinctBy { it.isoCode }
            .sortedWith { left, right -> collator.compare(left.label, right.label) }
    }

    private fun encodeCountryCode(value: String): Int {
        val normalized = value.uppercase(Locale.US)
        return normalized.fold(0) { accumulator, character ->
            (accumulator * 100) + character.code
        }
    }

    private data class SelectOption<T>(
        val label: String,
        val value: T,
    )

    private data class CountryOption(
        val label: String,
        val value: Int,
        val isoCode: String,
    )

    private data class SelectedDocument(
        val dataUrl: String,
        val displayName: String,
        val mimeType: String,
        val sizeBytes: Long?,
    )

    private enum class DocumentSide {
        FRONT,
        BACK,
    }

    private companion object {
        const val PAYMENT_CARD = "tarjeta_credito"
        const val PAYMENT_BANK = "cuenta_bancaria"
        const val PAYMENT_CHECK = "cheque_certificado"
        const val MAX_DOCUMENT_SIZE_BYTES = 5L * 1024L * 1024L
        val NON_DIGITS_REGEX = Regex("[^0-9]")
        val EMAIL_REGEX = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
        val EXPIRATION_REGEX = Regex("^(0[1-9]|1[0-2])/\\d{2}$")
        val DISPLAY_DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy")
        val EXPIRATION_DISPLAY_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("MM/yyyy")
        val EXPIRATION_VALUE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("MM/yy")
    }
}
