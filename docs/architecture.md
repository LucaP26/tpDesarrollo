# Arquitectura

## Capas

- `backend/` implementa la API REST, el WebSocket por subasta y un backoffice HTML minimo.
- `mobile/` contiene la app Expo con foco en postores y duenios.
- `backend/db/migrations/` separa el esquema legado corregido de las tablas nuevas necesarias para mobile.

## Backend

- `app/services/store.py`: estado inicial en memoria para demo y pruebas.
- `app/services/auctions.py`: acceso a subastas, reglas de categoria, pujas, limites y cierre.
- `app/services/auth.py`: registro, login y medios de pago.
- `app/services/consignments.py`: alta y consulta de bienes para futuras subastas.
- `app/services/admin.py`: aprobaciones y operaciones del backoffice.
- `app/api/routes.py`: endpoints REST y WebSocket.

## Mobile

- `app/index.tsx`, `app/login.tsx`, `app/register.tsx`: onboarding e ingreso.
- `app/(tabs)/auctions.tsx`: listado de subastas.
- `app/auction/[id].tsx`: sala de subasta y puja.
- `app/(tabs)/activity.tsx`: metricas y notificaciones.
- `app/(tabs)/sell.tsx`: consignaciones.
- `app/(tabs)/profile.tsx`: perfil y medios de pago.

## Persistencia

- `001_legacy_schema.sql` corrige sintaxis del SQL legado sin cambiar su contenido conceptual.
- `002_extended_schema.sql` agrega credenciales, medios de pago, multas, consignaciones, ubicaciones, seguros y vistas de soporte.

