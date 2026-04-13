from __future__ import annotations

from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from app.core.config import Settings


def _build_sqlalchemy_url(settings: Settings, database_name: str) -> str:
    if settings.sqlserver_driver.lower() == "pymssql":
        user = quote_plus(settings.sqlserver_user)
        password = quote_plus(settings.sqlserver_password)
        return f"mssql+pymssql://{user}:{password}@{settings.sqlserver_host}:{settings.sqlserver_port}/{database_name}"

    driver = quote_plus(settings.sqlserver_driver)
    if settings.sqlserver_trusted_connection:
        return (
            f"mssql+pyodbc://@{settings.sqlserver_host}:{settings.sqlserver_port}/{database_name}"
            f"?driver={driver}&trusted_connection=yes&Encrypt=no&TrustServerCertificate=yes"
        )
    user = quote_plus(settings.sqlserver_user)
    password = quote_plus(settings.sqlserver_password)
    return (
        f"mssql+pyodbc://{user}:{password}@{settings.sqlserver_host}:{settings.sqlserver_port}/{database_name}"
        f"?driver={driver}&Encrypt=no&TrustServerCertificate=yes"
    )


def create_engine_for_database(settings: Settings, database_name: str | None = None) -> Engine:
    target_name = database_name or settings.sqlserver_database
    return create_engine(
        _build_sqlalchemy_url(settings, target_name),
        future=True,
        pool_pre_ping=True,
    )


def run_sql_batches(engine: Engine, script: str) -> None:
    current: list[str] = []
    batches: list[str] = []
    for line in script.splitlines():
        if line.strip().upper() == "GO":
            batch = "\n".join(current).strip()
            if batch:
                batches.append(batch)
            current = []
            continue
        current.append(line)
    trailing = "\n".join(current).strip()
    if trailing:
        batches.append(trailing)

    with engine.begin() as connection:
        for batch in batches:
            connection.exec_driver_sql(batch)


def ensure_database_ready(settings: Settings) -> Engine:
    admin_engine = create_engine_for_database(settings, "master")
    db_name = settings.sqlserver_database.replace("]", "]]")
    with admin_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.exec_driver_sql(f"IF DB_ID(N'{db_name}') IS NULL CREATE DATABASE [{db_name}]")
    admin_engine.dispose()

    engine = create_engine_for_database(settings)
    migrations_dir = Path(__file__).resolve().parents[2] / "db" / "migrations"
    for migration in sorted(migrations_dir.glob("*.sql")):
        run_sql_batches(engine, migration.read_text(encoding="utf-8"))
    return engine
