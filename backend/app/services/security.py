import hashlib
import secrets


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return hash_secret(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    return hash_password(password) == password_hash


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def generate_numeric_code(length: int = 6) -> str:
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(length))
