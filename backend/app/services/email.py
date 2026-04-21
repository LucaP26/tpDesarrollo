from __future__ import annotations

import smtplib
from email.message import EmailMessage
from urllib.parse import urlencode

from fastapi import HTTPException, status

from app.core.config import Settings


class EmailService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _ensure_configured(self, detail: str) -> None:
        if not self.settings.smtp_host or not self.settings.smtp_from_email:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=detail,
            )

    def send_password_reset_code(self, recipient: str, full_name: str, code: str) -> None:
        self._ensure_configured("El servicio de correo no esta configurado. Define SMTP para recuperar contrasenas.")

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

    def send_welcome_password_setup_email(self, recipient: str, full_name: str, gender: str, token: str) -> None:
        self._ensure_configured("El servicio de correo no esta configurado. Define SMTP para enviar bienvenidas.")

        deep_link = f"{self.settings.mobile_password_setup_link_base}?{urlencode({'token': token, 'email': recipient})}"
        setup_link = f"{self.settings.password_setup_email_link_base}?{urlencode({'token': token, 'email': recipient})}"
        welcome_word = "Bienvenida" if gender == "femenino" else "Bienvenido"
        welcome_phrase = "Bienvenida" if gender == "femenino" else "Bienvenido"
        subject = f"{welcome_word} a Atelier | Activa tu acceso privado"
        greeting_name = full_name.strip() or "coleccionista"
        text_body = (
            f"Hola {greeting_name},\n\n"
            f"{welcome_phrase} a Atelier.\n\n"
            "Es un placer recibirte en una comunidad privada creada para amantes del patrimonio, la alta relojeria, "
            "el arte y las piezas de coleccion extraordinarias. Tu solicitud fue recibida correctamente y tu perfil "
            "ya forma parte del ecosistema Atelier.\n\n"
            "Para completar tu acceso personal, abre el siguiente enlace desde tu telefono y crea tu contrasena:\n"
            f"{setup_link}\n\n"
            f"Este acceso es personal y estara disponible durante {self.settings.password_setup_link_ttl_hours} horas.\n\n"
            f"{welcome_phrase} a la familia Atelier.\n"
            "Equipo Atelier"
        )
        html_body = f"""
        <html>
          <body style="margin:0;padding:0;background:#f5f1eb;font-family:Georgia,serif;color:#1f1711;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 18px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#111111;border-radius:24px;overflow:hidden;">
                    <tr>
                      <td style="padding:42px 40px 18px 40px;text-align:center;">
                        <div style="color:#cda75f;font-size:13px;letter-spacing:0.45em;">ATELIER</div>
                        <h1 style="margin:18px 0 0 0;color:#f5f1eb;font-size:34px;font-weight:600;">{welcome_word} a Atelier</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:12px 40px 42px 40px;">
                        <p style="margin:0 0 18px 0;color:#efe6db;font-size:18px;line-height:1.7;">
                          Hola {greeting_name},
                        </p>
                        <p style="margin:0 0 18px 0;color:#d5cabc;font-size:16px;line-height:1.8;">
                          Tu solicitud fue recibida correctamente y ya formas parte de un circulo pensado para
                          coleccionistas, conocedores y clientes que valoran la excelencia, la discrecion y el acceso
                          a subastas de categoria internacional.
                        </p>
                        <p style="margin:0 0 28px 0;color:#d5cabc;font-size:16px;line-height:1.8;">
                          Para activar tu acceso personal y definir tu contrasena privada, abre el siguiente enlace
                          desde tu telefono.
                        </p>
                        <p style="margin:24px 0 22px 0;text-align:center;">
                          <a
                            href="{setup_link}"
                            target="_blank"
                            style="color:#cda75f;font-family:Georgia,serif;font-size:18px;font-weight:700;line-height:1.7;text-decoration:underline;">
                            Regresa a la app y crea tu contrasena
                          </a>
                        </p>
                        <p style="margin:0;color:#a89a88;font-size:13px;line-height:1.7;">
                          Este acceso es personal y estara disponible durante {self.settings.password_setup_link_ttl_hours} horas.
                        </p>
                        <p style="margin:16px 0 0 0;color:#8f8578;font-size:12px;line-height:1.7;">
                          Si el boton no se abre automaticamente, utiliza este enlace desde tu dispositivo Android:<br />
                          <a href="{setup_link}" target="_blank" style="color:#cda75f;text-decoration:underline;word-break:break-all;">{setup_link}</a><br /><br />
                          En caso de necesitarlo, el enlace directo de la app es:<br />
                          <a href="{deep_link}" target="_blank" style="color:#cda75f;text-decoration:underline;word-break:break-all;">{deep_link}</a>
                        </p>
                        <p style="margin:26px 0 0 0;color:#efe6db;font-size:15px;line-height:1.7;">
                          {welcome_phrase} a la familia Atelier.<br />
                          Equipo Atelier
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self.settings.smtp_from_email
        message["To"] = recipient
        message.set_content(text_body)
        message.add_alternative(html_body, subtype="html")

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
                detail=f"No se pudo enviar el correo de bienvenida: {error}",
            ) from error

    def _authenticate_and_send(self, smtp: smtplib.SMTP, message: EmailMessage) -> None:
        if self.settings.smtp_user:
            smtp.login(self.settings.smtp_user, self.settings.smtp_password)
        smtp.send_message(message)
