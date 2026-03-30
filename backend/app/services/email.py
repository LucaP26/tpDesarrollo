from __future__ import annotations

import smtplib
from email.message import EmailMessage

from fastapi import HTTPException, status

from app.core.config import Settings


class EmailService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def send_password_reset_code(self, recipient: str, full_name: str, code: str) -> None:
        if not self.settings.smtp_host or not self.settings.smtp_from_email:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="El servicio de correo no esta configurado. Define SMTP para recuperar contrasenas.",
            )

        subject = "Recuperacion de contrasena - Sistema de Subastas"
        body = (
            f"Hola {full_name or 'usuario'},\n\n"
            "Recibimos una solicitud para restablecer tu contrasena.\n"
            f"Tu codigo de recuperacion es: {code}\n"
            f"Este codigo vence en {self.settings.password_reset_code_ttl_minutes} minutos.\n\n"
            "Si no solicitaste este cambio, puedes ignorar este correo.\n\n"
            "Sistema de Subastas"
        )

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self.settings.smtp_from_email
        message["To"] = recipient
        message.set_content(body)

        try:
            if self.settings.smtp_use_ssl:
                with smtplib.SMTP_SSL(self.settings.smtp_host, self.settings.smtp_port, timeout=20) as smtp:
                    self._authenticate_and_send(smtp, message)
                return

            with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=20) as smtp:
                if self.settings.smtp_use_starttls:
                    smtp.starttls()
                self._authenticate_and_send(smtp, message)
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"No se pudo enviar el correo de recuperacion: {error}",
            ) from error

    def _authenticate_and_send(self, smtp: smtplib.SMTP, message: EmailMessage) -> None:
        if self.settings.smtp_user:
            smtp.login(self.settings.smtp_user, self.settings.smtp_password)
        smtp.send_message(message)
