from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Sistema de Subastas API"
    api_prefix: str = "/api/v1"
    admin_prefix: str = "/admin"
    debug: bool = True
    cors_origins: list[str] = ["*"]
    sqlserver_host: str = "127.0.0.1"
    sqlserver_port: int = 1433
    sqlserver_database: str = "subastas_mobile"
    sqlserver_user: str = "sa"
    sqlserver_password: str = "Subastas12345!"
    sqlserver_driver: str = "ODBC Driver 18 for SQL Server"
    sqlserver_trusted_connection: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_starttls: bool = True
    smtp_use_ssl: bool = False
    password_reset_code_ttl_minutes: int = 15
    password_setup_link_ttl_hours: int = 72
    mobile_password_setup_link_base: str = "atelier://set-password"
    password_setup_email_link_base: str = "http://10.0.2.2:8000/password-setup/open"

    model_config = SettingsConfigDict(env_prefix="SUBASTAS_", env_file=".env")

settings = Settings()
