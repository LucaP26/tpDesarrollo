from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException, status

from app.core.time import utc_now
from app.domain.enums import NotificationKind, PaymentStatus, PaymentType, RegistrationStage, UserCategory
from app.domain.schemas import (
    AppUser,
    AuthTokenResponse,
    CompleteRegistrationRequest,
    LoginRequest,
    MessageResponse,
    OnboardingRegistrationRequest,
    PaymentMethodCreate,
    PaymentMethodRecord,
    PaymentMethodResponse,
    PasswordSetupRequest,
    ProfileAvatarUpdateRequest,
    ProfileUpdateRequest,
    PasswordResetTokenRecord,
    PasswordChangeRequest,
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
            first_name=user.first_name,
            last_name=user.last_name,
            full_name=f"{user.first_name} {user.last_name}",
            document_number=user.document_number,
            legal_address=user.legal_address,
            country_code=user.country_code,
            gender=user.gender,
            category=user.category,
            approved=user.approved,
            registration_stage=user.registration_stage,
            roles=user.roles,
            avatar_image_url=user.avatar_image_url,
        )

    def _validate_password_strength(self, password: str) -> None:
        if (
            len(password) < 6
            or not any(character.islower() for character in password)
            or not any(character.isupper() for character in password)
            or not any(character.isdigit() for character in password)
            or not any(not character.isalnum() for character in password)
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contrasena debe tener al menos 6 caracteres e incluir una minuscula, una mayuscula, un numero y un simbolo.",
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

    def _active_password_token(self, user_id: int, secret: str):
        token_hash = hash_secret(secret)
        now = utc_now()
        for token in self.store.password_reset_tokens.values():
            if token.user_id != user_id:
                continue
            if token.used_at is not None or token.expires_at < now:
                continue
            if token.token_hash == token_hash:
                return token
        return None

    def _find_user_by_email(self, email: str) -> AppUser | None:
        normalized_email = email.strip().lower()
        return next((item for item in self.store.users.values() if item.email == normalized_email), None)

    def _issue_password_setup_token(self, user_id: int) -> str:
        self._clear_stale_reset_tokens(user_id)
        raw_token = generate_token()
        now = utc_now()
        token_id = self.store.next_id("password_reset_tokens")
        self.store.password_reset_tokens[token_id] = PasswordResetTokenRecord(
            id=token_id,
            user_id=user_id,
            token_hash=hash_secret(raw_token),
            created_at=now,
            expires_at=now + timedelta(hours=self.email.settings.password_setup_link_ttl_hours),
            used_at=None,
        )
        return raw_token

    def _build_payment_method(self, user: AppUser, payload: PaymentMethodCreate) -> PaymentMethodRecord:
        return PaymentMethodRecord(
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

    def _ensure_payment_management_allowed(self, user: AppUser) -> None:
        if not user.approved:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La empresa debe aprobar tu registro antes de cargar medios de pago.",
            )
        if user.registration_stage != RegistrationStage.REGISTRO_COMPLETADO:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Completa la creacion de tu contrasena antes de cargar medios de pago.",
            )

    def _validate_payment_payload(self, payload: PaymentMethodCreate) -> None:
        if not payload.display_name.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El nombre del medio de pago es obligatorio.")
        if not payload.issuer_country.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes indicar el pais emisor del medio de pago.")
        if payload.available_amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debes declarar un monto reservado o disponible mayor a cero.",
            )
        if not (payload.holder_first_name or "").strip() or not (payload.holder_last_name or "").strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nombre y apellido del titular son obligatorios.")
        if payload.type == PaymentType.TARJETA_CREDITO and not (payload.last_four or "").strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La tarjeta debe informar sus ultimos cuatro digitos.")
        if payload.type == PaymentType.CUENTA_BANCARIA and not (payload.issuing_bank or "").strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cuenta bancaria debe informar el banco emisor.")

    def _is_legal_adult(self, birth_date: date) -> bool:
        today = utc_now().date()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        return age >= 18

    def pre_register(self, payload: PreRegisterRequest) -> RegistrationProgressResponse:
        existing = self._find_user_by_email(payload.email)
        if existing:
            if (
                existing.registration_stage == RegistrationStage.PRE_REGISTRO
                and not existing.password_hash
                and not existing.approved
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
                    message="Pre-registro actualizado. La empresa revisara tus datos antes de habilitar el acceso.",
                )

            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El email ya esta registrado.")

        user = AppUser(
            id=self.store.next_id("users"),
            email=payload.email,
            document_number=payload.document_number,
            first_name=payload.first_name,
            last_name=payload.last_name,
            gender="otro",
            birth_date=None,
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
            message="Pre-registro creado. La empresa verificara tus datos y, si te aprueba, recibiras el acceso para crear tu clave.",
        )

    def register_onboarding(self, payload: OnboardingRegistrationRequest) -> MessageResponse:
        normalized_email = payload.email.strip().lower()
        if not self._is_legal_adult(payload.birth_date):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo las personas mayores de 18 anos pueden acceder al sitio.",
            )
        existing = self._find_user_by_email(normalized_email)
        if existing and (existing.password_hash or existing.approved):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El email ya esta registrado.")

        if existing:
            user = existing
            user.email = normalized_email
            user.document_number = payload.document_number
            user.first_name = payload.first_name.strip()
            user.last_name = payload.last_name.strip()
            user.gender = payload.gender
            user.birth_date = payload.birth_date
            user.legal_address = payload.legal_address.strip()
            user.country_code = payload.country_code
            user.roles = payload.roles
            user.document_front_image_url = payload.document_front_image_url
            user.document_back_image_url = payload.document_back_image_url
            user.registration_stage = RegistrationStage.PRE_REGISTRO
        else:
            user = AppUser(
                id=self.store.next_id("users"),
                email=normalized_email,
                document_number=payload.document_number,
                first_name=payload.first_name.strip(),
                last_name=payload.last_name.strip(),
                gender=payload.gender,
                birth_date=payload.birth_date,
                legal_address=payload.legal_address.strip(),
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
            "Solicitud recibida",
            "La empresa revisara tus datos, documentacion y origen antes de aprobar tu categoria.",
            NotificationKind.INFO,
        )
        self.store.persist_all()
        return MessageResponse(
            message="Solicitud recibida. La empresa verificara tu identidad y te enviara el acceso para crear tu contrasena si eres aprobado."
        )

    def complete_registration(self, payload: CompleteRegistrationRequest) -> AuthTokenResponse:
        user = self.store.users.get(payload.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
        if not user.approved:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="La empresa debe aprobar el registro antes de crear la clave.")

        self._validate_password_strength(payload.password)
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

    def complete_password_setup(self, payload: PasswordSetupRequest) -> AuthTokenResponse:
        normalized_email = payload.email.strip().lower()
        user = self._find_user_by_email(normalized_email)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontramos una cuenta con ese correo.")
        if not user.approved:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="La empresa aun no aprobo tu registro.")
        self._validate_password_strength(payload.password)

        self._clear_stale_reset_tokens()
        token_record = self._active_password_token(user.id, payload.token.strip())
        if not token_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El enlace para crear la contrasena es invalido o ya vencio.",
            )

        user.password_hash = hash_password(payload.password)
        user.registration_stage = RegistrationStage.REGISTRO_COMPLETADO
        token_record.used_at = utc_now()
        session_token = generate_token()
        self.store.tokens[session_token] = user.id
        self.notifications.create(
            user.id,
            "Acceso activado",
            "Tu contrasena personal fue creada correctamente. Ya puedes ingresar a Atelier.",
            NotificationKind.OPERACION,
        )
        self.store.persist_all()
        return AuthTokenResponse(access_token=session_token, user=self._to_profile(user))

    def login(self, payload: LoginRequest) -> AuthTokenResponse:
        user = self._find_user_by_email(payload.email)
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
        if "@" not in normalized_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mail invalido.")

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
        user = self._find_user_by_email(normalized_email)
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
        self._validate_password_strength(payload.new_password)

        self._clear_stale_reset_tokens()
        token = self._active_password_token(user.id, payload.code.strip())
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

    def change_password(self, user: AppUser, payload: PasswordChangeRequest) -> MessageResponse:
        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contrasena actual es incorrecta.",
            )

        self._validate_password_strength(payload.new_password)

        if verify_password(payload.new_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La nueva contrasena no puede ser igual a la actual.",
            )

        user.password_hash = hash_password(payload.new_password)
        self.notifications.create(
            user.id,
            "Contrasena actualizada",
            "Tu contrasena se actualizo correctamente desde la seccion de seguridad.",
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
        self._ensure_payment_management_allowed(user)
        self._validate_payment_payload(payload)
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
        self._ensure_payment_management_allowed(user)
        self._validate_payment_payload(payload)
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
        user.payment_method_ids = [value for value in user.payment_method_ids if value != payment_id]
        self.notifications.create(
            user.id,
            "Medio de pago eliminado",
            "El medio de pago fue eliminado de tu perfil.",
            NotificationKind.INFO,
        )
        self.store.persist_all()
        return MessageResponse(message="El medio de pago fue eliminado correctamente.")
