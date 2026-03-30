# API Overview

La API queda expuesta bajo `/api/v1` y FastAPI publica Swagger automaticamente en `/docs`.

## Modulos principales

- `POST /auth/pre-register`
- `POST /auth/complete-registration`
- `POST /auth/login`
- `GET /auth/profile`
- `GET /payment-methods`
- `POST /payment-methods`
- `GET /subastas`
- `GET /subastas/{auction_id}`
- `POST /subastas/{auction_id}/join`
- `POST /subastas/{auction_id}/lotes/{lot_id}/pujas`
- `GET /notificaciones`
- `GET /metricas/personal`
- `GET /historial`
- `GET /consignaciones`
- `POST /consignaciones`
- `GET /admin/dashboard`
- `POST /admin/clientes/{user_id}/approve`
- `POST /admin/medios-pago/{payment_id}/verify`
- `POST /admin/consignaciones/{consignment_id}/review`
- `POST /admin/subastas`
- `POST /admin/subastas/{auction_id}/close`

## Tiempo real

- `WS /ws/subastas/{auction_id}?token=...`

El WebSocket difunde eventos `bid.updated` y admite `ping/pong` basico para mantener la conexion.
