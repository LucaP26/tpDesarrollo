package com.anonymous.sistemadesubastas.nativeapp.ui.profile

import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.anonymous.sistemadesubastas.R
import com.anonymous.sistemadesubastas.databinding.ActivityMessagesBinding
import com.anonymous.sistemadesubastas.nativeapp.data.core.AppExecutors
import com.anonymous.sistemadesubastas.nativeapp.data.model.CorrespondenceMessage
import com.anonymous.sistemadesubastas.nativeapp.data.model.MessageThread
import com.anonymous.sistemadesubastas.nativeapp.data.repository.ProfileRepository
import com.anonymous.sistemadesubastas.nativeapp.ui.common.BaseActivity
import com.anonymous.sistemadesubastas.nativeapp.ui.common.Formatters

class MessagesActivity : BaseActivity() {
    private lateinit var binding: ActivityMessagesBinding
    private val profileRepository by lazy { ProfileRepository(apiClient) }
    private var selectedThreadId: Int? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!sessionManager.isLoggedIn()) {
            restartToLogin()
            return
        }

        binding = ActivityMessagesBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.backButton.setOnClickListener { finish() }
        binding.sendButton.setOnClickListener { sendMessage() }
        loadThreads()
    }

    override fun shouldMonitorNetwork(): Boolean = true

    private fun loadThreads() {
        AppExecutors.ioThenMain(
            task = { profileRepository.messageThreads() },
            onSuccess = { threads ->
                renderThreads(threads)
                val selected = selectedThreadId?.let { id -> threads.firstOrNull { it.id == id } } ?: threads.firstOrNull()
                if (selected != null) {
                    selectedThreadId = selected.id
                    loadThread(selected.id)
                } else {
                    renderConversation(null)
                }
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No se pudieron cargar tus mensajes",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun loadThread(threadId: Int) {
        AppExecutors.ioThenMain(
            task = { profileRepository.messageThread(threadId) },
            onSuccess = { thread ->
                selectedThreadId = thread.id
                renderConversation(thread)
            },
            onError = { throwable ->
                showErrorOrHandleSession(
                    title = "No se pudo abrir la conversacion",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun renderThreads(threads: List<MessageThread>) {
        binding.threadsContainer.removeAllViews()
        binding.emptyThreadsText.visibility = if (threads.isEmpty()) View.VISIBLE else View.GONE

        threads.forEach { thread ->
            val card = TextView(this).apply {
                setBackgroundResource(R.drawable.bg_card_surface)
                setPadding(dp(16), dp(14), dp(16), dp(14))
                text = buildThreadText(thread)
                setTextColor(ContextCompat.getColor(this@MessagesActivity, R.color.atelier_ink))
                textSize = 15f
                setOnClickListener {
                    selectedThreadId = thread.id
                    loadThread(thread.id)
                }
            }
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(10)
            }
            binding.threadsContainer.addView(card, params)
        }
    }

    private fun buildThreadText(thread: MessageThread): String {
        val last = thread.lastMessage?.body?.takeIf { it.isNotBlank() } ?: "Sin mensajes."
        return "${thread.subject}\n${Formatters.date(thread.updatedAt)} - $last"
    }

    private fun renderConversation(thread: MessageThread?) {
        binding.messagesContainer.removeAllViews()
        binding.composerGroup.visibility = if (thread == null) View.GONE else View.VISIBLE
        binding.conversationTitleText.text = thread?.subject.orEmpty()
        if (thread == null) {
            return
        }
        thread.messages.forEach { message ->
            binding.messagesContainer.addView(messageView(message))
        }
    }

    private fun messageView(message: CorrespondenceMessage): View {
        val isCompany = message.senderType == "empresa"
        val bubble = TextView(this).apply {
            setBackgroundResource(if (isCompany) R.drawable.bg_card_surface else R.drawable.bg_chip_surface)
            setPadding(dp(14), dp(12), dp(14), dp(12))
            text = "${if (isCompany) "ATELIER" else "Vos"}\n${message.body}\n${Formatters.date(message.createdAt)}"
            setTextColor(ContextCompat.getColor(this@MessagesActivity, R.color.atelier_ink))
            textSize = 14f
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = if (isCompany) Gravity.START else Gravity.END
            addView(
                bubble,
                LinearLayout.LayoutParams(
                    (resources.displayMetrics.widthPixels * 0.78f).toInt(),
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            )
        }
        row.layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = dp(10)
        }
        return row
    }

    private fun sendMessage() {
        val threadId = selectedThreadId ?: return
        val body = binding.messageInput.text?.toString().orEmpty().trim()
        if (body.isBlank()) {
            alert("Mensaje vacio", "Escribi una respuesta antes de enviar.")
            return
        }
        binding.sendButton.isEnabled = false
        binding.sendButton.text = "Enviando..."
        AppExecutors.ioThenMain(
            task = { profileRepository.sendMessage(threadId, body) },
            onSuccess = { thread ->
                binding.sendButton.isEnabled = true
                binding.sendButton.text = "Enviar"
                binding.messageInput.text?.clear()
                selectedThreadId = thread.id
                renderConversation(thread)
                loadThreads()
            },
            onError = { throwable ->
                binding.sendButton.isEnabled = true
                binding.sendButton.text = "Enviar"
                showErrorOrHandleSession(
                    title = "No se pudo enviar",
                    throwable = throwable,
                    fallbackMessage = "Intenta de nuevo."
                )
            }
        )
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
