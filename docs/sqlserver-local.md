# SQL Server local

## Stack local

- Motor: SQL Server 2022 Express en Docker
- Puerto: `1433`
- Base: `subastas_mobile`
- Usuario: `sa`
- Password: `Subastas12345!`

## Arranque

```bash
docker compose up -d
```

## Backend

El backend lee `.env` y si `SUBASTAS_STORAGE_MODE=sqlserver`:

1. crea la base si no existe
2. ejecuta las migraciones `001`, `002` y `003`
3. si las tablas `app_*` estan vacias, siembra la base con los datos demo
4. desde ese momento persiste cambios en SQL Server

## Datos persistidos

Las tablas `app_*` guardan el estado operativo que antes vivia solo en memoria:

- usuarios
- medios de pago
- subastas
- lotes
- pujas
- notificaciones
- consignaciones
- compras
- multas
- asistencias

El esquema legado sigue presente y sin cambios semanticos; las tablas `app_*` funcionan como extension operativa para la app.
