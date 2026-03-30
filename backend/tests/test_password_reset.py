from __future__ import annotations

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.domain.enums import RegistrationStage, UserCategory, UserRole
from app.domain.schemas import AppUser, PasswordResetConfirmRequest, PasswordResetRequest
from app.services.auth import AuthService
from app.services.notifications import NotificationService
from app.services.security import hash_password
from app.services.store import StoreBase


class FakeStore(StoreBase):
    def persist_all(self) -> None:
        return None


class FakeEmailService:
    class settings:
        password_reset_code_ttl_minutes = 15

    def __init__(self) -> None:
        self.sent_messages: list[dict[str, str]] = []

    def send_password_reset_code(self, recipient: str, full_name: str, code: str) -> None:
        self.sent_messages.append(
            {"recipient": recipient, "full_name": full_name, "code": code}
        )


def build_user() -> AppUser:
    return AppUser(
        id=1,
        email="usuario@example.com",
        document_number="30111222",
        first_name="Ana",
        last_name="Lopez",
        legal_address="Calle 123",
        country_code=32,
        category=UserCategory.COMUN,
        approved=True,
        registration_stage=RegistrationStage.REGISTRO_COMPLETADO,
        roles=[UserRole.CLIENTE],
        password_hash=hash_password("clave-vieja"),
    )


def test_request_password_reset_generates_code_and_persists_token() -> None:
    store = FakeStore()
    notifications = NotificationService(store)
    email = FakeEmailService()
    auth = AuthService(store, notifications, email)
    user = build_user()
    store.users[user.id] = user

    response = auth.request_password_reset(PasswordResetRequest(email=user.email))

    assert "Si existe una cuenta" in response.message
    assert len(email.sent_messages) == 1
    assert email.sent_messages[0]["recipient"] == user.email
    assert len(store.password_reset_tokens) == 1


def test_confirm_password_reset_updates_password_and_consumes_code() -> None:
    store = FakeStore()
    notifications = NotificationService(store)
    email = FakeEmailService()
    auth = AuthService(store, notifications, email)
    user = build_user()
    store.users[user.id] = user

    auth.request_password_reset(PasswordResetRequest(email=user.email))
    code = email.sent_messages[0]["code"]

    response = auth.confirm_password_reset(
        PasswordResetConfirmRequest(
            email=user.email,
            code=code,
            new_password="nueva-clave-123",
        )
    )

    assert response.message == "Tu contrasena fue actualizada correctamente."
    assert user.password_hash == hash_password("nueva-clave-123")
    assert next(iter(store.password_reset_tokens.values())).used_at is not None
