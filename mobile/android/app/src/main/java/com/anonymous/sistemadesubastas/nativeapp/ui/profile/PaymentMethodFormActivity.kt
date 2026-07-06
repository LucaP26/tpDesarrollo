package com.anonymous.sistemadesubastas.nativeapp.ui.profile

import android.app.DatePickerDialog
import android.os.Bundle
import android.text.InputFilter
import android.text.InputType
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import com.anonymous.sistemadesubastas.R
import com.anonymous.sistemadesubastas.databinding.ActivityPaymentMethodFormBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.repository.ProfileRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Calendar

class PaymentMethodFormActivity : BaseActivity() {
    private lateinit var binding: ActivityPaymentMethodFormBinding
    private val profileRepository by lazy { ProfileRepository(apiClient) }

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

    private val lettersOnlyFilter = InputFilter { source, _, _, _, _, _ ->
        if (source == null) {
            return@InputFilter null
        }
        val filtered = source.filter { character ->
            character.isLetter() || character.isWhitespace() || character == '\'' || character == '-'
        }
        if (filtered == source.toString()) null else filtered
    }

    private var selectedPaymentType = paymentTypeOptions.first()
    private var selectedCurrency = currencyOptions.first()
    private var selectedBank = bankOptions.first()
    private var selectedCardBrand = cardBrandOptions.first()
    private var selectedExpirationDate: LocalDate? = null
    private var isSaving = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }

        binding = ActivityPaymentMethodFormBinding.inflate(layoutInflater)
        setContentView(binding.root)

        applyInputRules()
        bindActions()
        updatePaymentUi()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    private fun applyInputRules() {
        binding.holderFirstNameInput.filters = arrayOf(lettersOnlyFilter)
        binding.holderLastNameInput.filters = arrayOf(lettersOnlyFilter)
        binding.cardNumberInput.inputType = InputType.TYPE_CLASS_NUMBER
        binding.cardNumberInput.filters = arrayOf(InputFilter.LengthFilter(16))
        binding.securityCodeInput.inputType = InputType.TYPE_CLASS_NUMBER
        binding.securityCodeInput.filters = arrayOf(InputFilter.LengthFilter(3))
        binding.checkAmountInput.inputType = InputType.TYPE_CLASS_NUMBER
    }

    private fun bindActions() {
        binding.backButton.setOnClickListener { finish() }
        binding.paymentTypeValue.setOnClickListener {
            showSelector("Medio de pago", paymentTypeOptions, selectedPaymentType) { option ->
                selectedPaymentType = option
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
        binding.expirationDateValue.setOnClickListener {
            showExpirationDatePicker()
        }
        binding.submitButton.setOnClickListener { submitPaymentMethod() }
    }

    private fun submitPaymentMethod() {
        if (isSaving) {
            return
        }

        val holderFirstName = binding.holderFirstNameInput.text?.toString().orEmpty().trim()
        val holderLastName = binding.holderLastNameInput.text?.toString().orEmpty().trim()
        val issuerCountry = binding.issuerCountryInput.text?.toString().orEmpty().trim().uppercase()
        val cardNumber = keepNumeric(binding.cardNumberInput.text?.toString().orEmpty())
        val securityCode = keepNumeric(binding.securityCodeInput.text?.toString().orEmpty())
        val expirationDate = selectedExpirationDate?.format(EXPIRATION_VALUE_FORMAT)
        val amountText = keepNumeric(binding.checkAmountInput.text?.toString().orEmpty())

        if (holderFirstName.isBlank() || holderLastName.isBlank()) {
            alert("Faltan datos", "Ingresa nombre y apellido del titular para continuar.")
            return
        }
        if (issuerCountry.isBlank()) {
            alert("Pais emisor obligatorio", "Indica el pais emisor del medio de pago.")
            return
        }
        val numericAmount = amountText.toDoubleOrNull()
        if (numericAmount == null || numericAmount <= 0.0) {
            alert("Monto invalido", "Ingresa el monto reservado o disponible para la subasta.")
            return
        }

        val payload = org.json.JSONObject()
            .put("type", selectedPaymentType.value)
            .put("issuer_country", issuerCountry)
            .put("holder_first_name", holderFirstName)
            .put("holder_last_name", holderLastName)

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
                if (expirationDate.isNullOrBlank()) {
                    alert("Vencimiento invalido", "Selecciona la fecha de vencimiento de la tarjeta.")
                    return
                }
                payload
                    .put("display_name", "${selectedCardBrand.value} terminada en ${cardNumber.takeLast(4)}")
                    .put("currency", selectedCurrency.value)
                    .put("available_amount", numericAmount)
                    .put("last_four", cardNumber.takeLast(4))
                    .put("issuing_bank", selectedBank.value)
                    .put("expiration_date", expirationDate)
            }

            PAYMENT_BANK -> {
                payload
                    .put("display_name", "Cuenta bancaria ${selectedBank.value}")
                    .put("currency", selectedCurrency.value)
                    .put("available_amount", numericAmount)
                    .put("issuing_bank", selectedBank.value)
            }

            PAYMENT_CHECK -> {
                payload
                    .put("display_name", "Cheque certificado ${selectedCurrency.value}")
                    .put("currency", selectedCurrency.value)
                    .put("available_amount", numericAmount)
            }
        }

        isSaving = true
        binding.submitButton.isEnabled = false

        AppExecutors.ioThenMain(
            task = { profileRepository.createPaymentMethod(payload) },
            onSuccess = {
                isSaving = false
                binding.submitButton.isEnabled = true
                toast("Medio de pago agregado correctamente.")
                setResult(RESULT_OK)
                finish()
            },
            onError = { throwable ->
                isSaving = false
                binding.submitButton.isEnabled = true
                showErrorOrHandleSession(
                    title = "No se pudo guardar el medio de pago",
                    throwable = throwable,
                    fallbackMessage = "Intenta nuevamente."
                )
            }
        )
    }

    private fun updatePaymentUi() {
        val paymentType = selectedPaymentType.value
        binding.paymentTypeValue.text = selectedPaymentType.label
        binding.currencyValue.text = selectedCurrency.label
        binding.bankValue.text = selectedBank.label
        binding.cardBrandValue.text = selectedCardBrand.label
        binding.expirationDateValue.text = selectedExpirationDate?.format(EXPIRATION_DISPLAY_FORMAT)
            ?: "Selecciona la fecha de vencimiento"

        binding.currencyFieldGroup.visibility = android.view.View.VISIBLE
        binding.bankFieldGroup.visibility =
            if (paymentType == PAYMENT_CARD || paymentType == PAYMENT_BANK) android.view.View.VISIBLE else android.view.View.GONE
        binding.cardFieldsGroup.visibility =
            if (paymentType == PAYMENT_CARD) android.view.View.VISIBLE else android.view.View.GONE
        binding.checkAmountGroup.visibility = android.view.View.VISIBLE
    }

    private fun showExpirationDatePicker() {
        val initialDate = selectedExpirationDate ?: LocalDate.now()
        val calendar = Calendar.getInstance().apply {
            set(initialDate.year, initialDate.monthValue - 1, initialDate.dayOfMonth)
        }

        val picker = DatePickerDialog(
            this,
            { _, year, month, _ ->
                selectedExpirationDate = LocalDate.of(year, month + 1, 1)
                binding.expirationDateValue.text = selectedExpirationDate?.format(EXPIRATION_DISPLAY_FORMAT)
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH),
        )
        picker.datePicker.minDate = System.currentTimeMillis()
        styleDatePickerButtons(picker)
        picker.show()
    }

    private fun <T> showSelector(
        title: String,
        options: List<SelectOption<T>>,
        selected: SelectOption<T>,
        onSelected: (SelectOption<T>) -> Unit,
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

    private fun styleDatePickerButtons(dialog: DatePickerDialog) {
        dialog.setOnShowListener {
            val color = ContextCompat.getColor(this, R.color.atelier_action)
            dialog.getButton(DatePickerDialog.BUTTON_POSITIVE)?.setTextColor(color)
            dialog.getButton(DatePickerDialog.BUTTON_NEGATIVE)?.setTextColor(color)
        }
    }

    private fun keepNumeric(value: String): String = value.replace(NON_DIGITS_REGEX, "")

    private data class SelectOption<T>(
        val label: String,
        val value: T,
    )

    companion object {
        const val PAYMENT_CARD = "tarjeta_credito"
        const val PAYMENT_BANK = "cuenta_bancaria"
        const val PAYMENT_CHECK = "cheque_certificado"

        private val NON_DIGITS_REGEX = Regex("[^0-9]")
        private val EXPIRATION_DISPLAY_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("MM/yyyy")
        private val EXPIRATION_VALUE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("MM/yy")
    }
}
