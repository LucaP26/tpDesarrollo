# Sistema de Subastas Mobile

Monorepo inicial para el TPO de subastas con:

- `backend/`: API REST + WebSocket + backoffice minimo en `FastAPI`
- `mobile/`: app movil en `React Native + Expo`
- `docs/`: arquitectura, alcance y notas de integracion

## Estado actual

Se implemento una base funcional alineada al plan:

- backend Python con modulos de autenticacion, medios de pago, subastas, pujas, consignaciones, metricas, notificaciones y admin
- WebSocket por subasta para difundir cambios de pujas en tiempo real
- migraciones SQL Server que preservan el esquema legado y agregan tablas nuevas sin modificar su contenido conceptual
- persistencia real en SQL Server para el estado operativo de la app
- backoffice HTML minimo para aprobar usuarios, verificar medios de pago, revisar consignaciones y cerrar subastas
- app Expo con onboarding, login, listado de subastas, detalle de sala, actividad, consignaciones y perfil
- el runtime de backend y mobile trabaja solo contra servicios reales; ya no existe fallback mock ni store en memoria para la app

## Como levantar SQL Server local

1. Levantar Docker Desktop.
2. Desde la raiz del repo:

```bash
docker compose up -d
```

Esto crea un SQL Server local en `127.0.0.1:1433` con la base configurada por `.env`.

## Como levantar el backend

1. Instalar Python 3.12 o superior.
2. Crear un entorno virtual.
3. Instalar dependencias:

```bash
pip install -e backend
python -m uvicorn app.main:app --reload --app-dir backend
```

La documentacion OpenAPI quedara en `http://localhost:8000/docs`.

## Recuperacion de contrasena por email

El flujo "Olvide mi contrasena" envia un codigo de recuperacion al correo asociado al usuario y permite restablecer la clave desde la app.

Para usarlo con envio real debes configurar SMTP en `.env`:

```bash
SUBASTAS_SMTP_HOST=smtp.tu-servidor.com
SUBASTAS_SMTP_PORT=587
SUBASTAS_SMTP_USER=usuario_smtp
SUBASTAS_SMTP_PASSWORD=clave_smtp
SUBASTAS_SMTP_FROM_EMAIL=no-reply@tudominio.com
SUBASTAS_SMTP_USE_STARTTLS=true
SUBASTAS_SMTP_USE_SSL=false
SUBASTAS_PASSWORD_RESET_CODE_TTL_MINUTES=15
```

## Como levantar la app movil

1. Instalar Node.js 20+ y un package manager.
2. Desde `mobile/` instalar dependencias:

```bash
npm install
npm run start
```

3. Configurar `EXPO_PUBLIC_API_BASE_URL` si el backend corre fuera de `localhost`.

## Importante

- El backend usa SQL Server de forma obligatoria segun la configuracion de `.env`.
- La migracion [001_legacy_schema.sql](/C:/Users/Male_/OneDrive/Documents/Playground/backend/db/migrations/001_legacy_schema.sql) esta basada en `EstructuraActual.sql` y preserva su contenido conceptual corrigiendo solo la sintaxis necesaria para ejecutarlo.
- La app Expo requiere `EXPO_PUBLIC_API_BASE_URL`; si falta, el cliente falla en vez de inventar datos locales.
