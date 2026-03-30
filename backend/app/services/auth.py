from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException, status

from app.core.time import utc_now
from app.domain.enums import NotificationKind, PaymentStatus, RegistrationStage, UserCategory
from app.domain.schemas import (
    AppUser,
    AuthTokenResponse,
    CompleteRegistrationRequest,
    LoginRequest,
    MessageResponse,
    PaymentMethodCreate,
    PaymentMethodRecord,
    PaymentMethodResponse,
    ProfileAvatarUpdateRequest,
    ProfileUpdateRequest,
    PasswordResetTokenRecord,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PreRegisterRequest,
    RegistrationProgressResponse,
    UserProfileResponse,
    PaymentMethodUpdate,
)
from app.services.email import EmailService
from app.services.notifications import NotificationService
from app.services.security import generate_numeric_code, generate_token, hash_password, hash_secret, verify_password
from app.services.store import StoreBase
from app.services.user_categories import promote_user_category


class AuthService:
    def __init__(self, store: StoreBase, notifications: NotificationService, email: EmailService) -> None:
        self.store = store
        self.notifications = notifications
        self.email = email

    def _to_profile(self, user: AppUser) -> UserProfileResponse:
        return UserProfileResponse(
            id=user.id,
            email=user.email,
            full_name=f"{user.first_name} {user.last_name}",
            document_number=user.document_number,
            legal_address=user.legal_address,
            country_code=user.country_code,
            category=user.category,
            approved=user.approved,
            registration_stage=user.registration_stage,
            roles=user.roles,
            avatar_image_url=user.avatar_image_url,
        )

    def _sync_category(self, user: AppUser) -> None:
        if promote_user_category(self.store, self.notifications, user):
            self.store.persist_all()

    def _clear_stale_reset_tokens(self, user_id: int | None = None) -> None:
        now = utc_now()
        cleaned: dict[int, PasswordResetTokenRecord] = {}
        for token_id, token in self.store.password_reset_tokens.items():
            if token.used_at is not None or token.expires_at < now:
                continue
            if user_id is not None and token.user_id == user_id:
                continue
            cleaned[token_id] = token
        self.store.password_reset_tokens = cleaned

    def _active_reset_token(self, user_id: int, code: str):
        token_hash = hash_secret(code)
        now = utc_now()
        for token in self.store.password_reset_tokens.values():
            if token.user_id != user_id:
                continue
            if token.used_at is not None or token.expires_at < now:
                continue
            if token.token_hash == token_hash:
                return token
        return None

    def pre_register(self, payload: PreRegisterRequest) -> RegistrationProgressResponse:
        existing = next((item for item in self.store.users.values() if item.email == payload.email), None)
        if existing:
            if (
                existing.registration_stage == RegistrationStage.PRE_REGISTRO
                and not existing.password_hash
            ):
                existing.document_number = payload.document_number
                existing.first_name = payload.first_name
                existing.last_name = payload.last_name
                existing.legal_address = payload.legal_address
                existing.country_code = payload.country_code
                existing.roles = payload.roles
                existing.document_front_image_url = payload.document_front_image_url
                existing.document_back_image_url = payload.document_back_image_url
                self.store.persist_all()
                return RegistrationProgressResponse(
                    user_id=existing.id,
                    registration_stage=existing.registration_stage,
                    approved=existing.approved,
                    message="Pre-registro actualizado. Continua con la carga del medio de pago.",
                )

            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El email ya esta registrado.")

        user = AppUser(
            id=self.store.next_id("users"),
            email=payload.email,
            document_number=payload.document_number,
            first_name=payload.first_name,
            last_name=payload.last_name,
            legal_address=payload.legal_address,
            country_code=payload.country_code,
            category=UserCategory.COMUN,
            approved=False,
            registration_stage=RegistrationStage.PRE_REGISTRO,
            roles=payload.roles,
            document_front_image_url=payload.document_front_image_url,
            document_back_image_url=payload.document_back_image_url,
        )
        self.store.users[user.id] = user
        self.notifications.create(
            user.id,
            "Pre-registro recibido",
            "La empresa recibio tu documentacion y revisara los datos cargados.",
            NotificationKind.INFO,
        )
        self.store.persist_all()
        return RegistrationProgressResponse(
            user_id=user.id,
            registration_stage=user.registration_stage,
            approved=user.approved,
            message="Pre-registro creado. Falta aprobacion de la empresa y definir la clave.",
        )

    def complete_registration(self, payload: CompleteRegistrationRequest) -> AuthTokenResponse:
        user = self.store.users.get(payload.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

        user.password_hash = hash_password(payload.password)
        user.registration_stage = RegistrationStage.REGISTRO_COMPLETADO
        token = generate_token()
        self.store.tokens[token] = user.id
        self.notifications.create(
            user.id,
            "Registro finalizado",
            "Ya podes ingresar a la app y registrar medios de pago.",
            NotificationKind.OPERACION,
        )
        self.store.persist_all()
        return AuthTokenResponse(access_token=token, user=self._to_profile(user))

    def login(self, payload: LoginRequest) -> AuthTokenResponse:
        user = next((item for item in self.store.users.values() if item.email == payload.email), None)
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales invalidas.")

        self._sync_category(user)
        token = generate_token()
        self.store.tokens[token] = user.id
        return AuthTokenResponse(access_token=token, user=self._to_profile(user))

    def get_user_by_token(self, token: str) -> AppUser:
        user_id = self.store.tokens.get(token)
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido.")
        return self.store.users[user_id]

    def get_profile(self, user: AppUser) -> UserProfileResponse:
        self._sync_category(user)
        return self._to_profile(user)

    def update_profile_avatar(self, user: AppUser, payload: ProfileAvatarUpdateRequest) -> UserProfileResponse:
        avatar_image_url = payload.avatar_image_url.strip()
        if not avatar_image_url:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La imagen de perfil es obligatoria.")

        user.avatar_image_url = avatar_image_url
        self.store.persist_all()
        return self._to_profile(user)

    def update_profile(self, user: AppUser, payload: ProfileUpdateRequest) -> UserProfileResponse:
        normalized_email = payload.email.strip().lower()
        if not normalized_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El correo electronico es obligatorio.")

        if not payload.first_name.strip() or not payload.last_name.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nombre y apellido son obligatorios.")

        if not payload.legal_address.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La direccion principal es obligatoria.")

        existing = next(
            (item for item in self.store.users.values() if item.email == normalized_email and item.id != user.id),
            None,
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese correo electronico ya esta en uso.")

        user.first_name = payload.first_name.strip()
        user.last_name = payload.last_name.strip()
        user.email = normalized_email
        user.legal_address = payload.legal_address.strip()
        self.store.persist_all()
        return self._to_profile(user)

    def request_password_reset(self, payload: PasswordResetRequest) -> MessageResponse:
        normalized_email = payload.email.strip().lower()
        user = next((item for item in self.store.users.values() if item.email == normalized_email), None)
        if not user or not user.password_hash:
            return MessageResponse(
                message="Si existe una cuenta asociada a ese correo, te enviamos un codigo para recuperar la contrasena."
            )

        self._clear_stale_reset_tokens(user.id)
        code = generate_numeric_code()
        now = utc_now()
        reset_token_id = self.store.next_id("password_reset_tokens")
        self.store.password_reset_tokens[reset_token_id] = PasswordResetTokenRecord(
            id=reset_token_id,
            user_id=user.id,
            token_hash=hash_secret(code),
            created_at=now,
            expires_at=now + timedelta(minutes=self.email.settings.password_reset_code_ttl_minutes),
            used_at=None,
        )
        try:
            self.email.send_password_reset_code(user.email, f"{user.first_name} {user.last_name}".strip(), code)
        except Exception:
            self.store.password_reset_tokens.pop(reset_token_id, None)
            raise
        self.store.persist_all()
        return MessageResponse(
            message="Si existe una cuenta asociada a ese correo, te enviamos un codigo para recuperar la contrasena."
        )

    def confirm_password_reset(self, payload: PasswordResetConfirmRequest) -> MessageResponse:
        normalized_email = payload.email.strip().lower()
        user = next((item for item in self.store.users.values() if item.email == normalized_email), None)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontramos una cuenta con ese correo.")
        if len(payload.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contrasena nueva debe tener al menos 6 caracteres.",
            )

        self._clear_stale_reset_tokens()
        token = self._active_reset_token(user.id, payload.code.strip())
        if not token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El codigo de recuperacion es invalido o ya vencio.",
            )

        user.password_hash = hash_password(payload.new_password)
        user.registration_stage = RegistrationStage.REGISTRO_COMPLETADO
        token.used_at = utc_now()
        self.notifications.create(
            user.id,
            "Contrasena actualizada",
            "Tu contrasena fue restablecida correctamente.",
            NotificationKind.OPERACION,
        )
        self.store.persist_all()
        return MessageResponse(message="Tu contrasena fue actualizada correctamente.")

    def list_payment_methods(self, user: AppUser) -> list[PaymentMethodResponse]:
        self._sync_category(user)
        return [
            PaymentMethodResponse(
                id=method.id,
                type=method.type,
                display_name=method.display_name,
                currency=method.currency,
                issuer_country=method.issuer_country,
                available_amount=method.available_amount,
                status=method.status,
                last_four=method.last_four,
                holder_first_name=method.holder_first_name,
                holder_last_name=method.holder_last_name,
                issuing_bank=method.issuing_bank,
                expiration_date=method.expiration_date,
            )
            for method in self.store.payment_methods.values()
            if method.user_id == user.id
        ]

    def create_payment_method(self, user: AppUser, payload: PaymentMethodCreate) -> PaymentMethodResponse:
        payment = PaymentMethodRecord(
            id=self.store.next_id("payments"),
            user_id=user.id,
            type=payload.type,
            display_name=payload.display_name,
            currency=payload.currency,
            issuer_country=payload.issuer_country,
            available_amount=payload.available_amount,
            last_four=payload.last_four,
            holder_first_name=payload.holder_first_name,
            holder_last_name=payload.holder_last_name,
            issuing_bank=payload.issuing_bank,
            expiration_date=payload.expiration_date,
        )
        self.store.payment_methods[payment.id] = payment
        user.payment_method_ids.append(payment.id)
        self.notifications.create(
            user.id,
            "Medio de pago recibido",
            "La empresa debe verificarlo antes de habilitar tus pujas.",
            NotificationKind.INFO,
        )
        promote_user_category(self.store, self.notifications, user)
        self.store.persist_all()
        return PaymentMethodResponse(
            id=payment.id,
            type=payment.type,
            display_name=payment.display_name,
            currency=payment.currency,
            issuer_country=payment.issuer_country,
            available_amount=payment.available_amount,
            status=payment.status,
            last_four=payment.last_four,
            holder_first_name=payment.holder_first_name,
            holder_last_name=payment.holder_last_name,
            issuing_bank=payment.issuing_bank,
            expiration_date=payment.expiration_date,
        )

    def update_payment_method(self, user: AppUser, payment_id: int, payload: PaymentMethodUpdate) -> PaymentMethodResponse:
        payment = self.store.payment_methods.get(payment_id)
        if not payment or payment.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medio de pago no encontrado.")

        payment.type = payload.type
        payment.display_name = payload.display_name
        payment.currency = payload.currency
        payment.issuer_country = payload.issuer_country
        payment.available_amount = payload.available_amount
        payment.last_four = payload.last_four
        payment.holder_first_name = payload.holder_first_name
        payment.holder_last_name = payload.holder_last_name
        payment.issuing_bank = payload.issuing_bank
        payment.expiration_date = payload.expiration_date
        payment.status = PaymentStatus.PENDIENTE
        payment.verified_at = None

        self.notifications.create(
            user.id,
            "Medio de pago actualizado",
            "La empresa debe verificar nuevamente el medio de pago editado.",
            NotificationKind.INFO,
        )
        self.store.persist_all()
        return PaymentMethodResponse(
            id=payment.id,
            type=payment.type,
            display_name=payment.display_name,
            currency=payment.currency,
            issuer_country=payment.issuer_country,
            available_amount=payment.available_amount,
            status=payment.status,
            last_four=payment.last_four,
            holder_first_name=payment.holder_first_name,
            holder_last_name=payment.holder_last_name,
            issuing_bank=payment.issuing_bank,
            expiration_date=payment.expiration_date,
        )

    def delete_payment_method(self, user: AppUser, payment_id: int) -> MessageResponse:
        payment = self.store.payment_methods.get(payment_id)
        if not payment or payment.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medio de pago no encontrado.")

        self.store.payment_methods.pop(payment_id, None)
        self.notifications.create(
            user.id,
            "Medio de pago eliminado",
            "El medio de pago fue eliminado de tu perfil.",
            NotificationKind.INFO,
        )
        self.store.persist_all()
        return MessageResponse(message="El medio de pago fue eliminado correctamente.")
