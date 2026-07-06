from __future__ import annotations

from pathlib import Path
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, FastAPI, Form, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.templating import Jinja2Templates

from app.domain.schemas import (
    AdminAuctionCreateRequest,
    AdminConsignmentReviewRequest,
    AdminUserApprovalRequest,
    ActiveAuctionResponse,
    AppUser,
    AuthTokenResponse,
    BidCreate,
    BidResponse,
    CompleteRegistrationRequest,
    ConsignmentCreate,
    ConsignmentProposalDecisionRequest,
    ConsignmentResponse,
    CorrespondenceMessageCreate,
    HistoryEntryResponse,
    JoinAuctionResponse,
    LeaveAuctionResponse,
    LoginRequest,
    MessageResponse,
    MessageThreadResponse,
    MetricsResponse,
    NotificationResponse,
    OnboardingRegistrationRequest,
    AuctionDetailResponse,
    AuctionSummaryResponse,
    PaymentMethodCreate,
    PaymentMethodResponse,
    PaymentMethodUpdate,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PasswordChangeRequest,
    PasswordSetupRequest,
    ProfileAvatarUpdateRequest,
    ProfileUpdateRequest,
    PreRegisterRequest,
    RegistrationProgressResponse,
    UserProfileResponse,
)
from app.domain.enums import UserCategory
from app.services.container import ServiceContainer

api_router = APIRouter()
admin_router = APIRouter()
public_router = APIRouter()
security = HTTPBearer(auto_error=False)
templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent.parent / "templates"))


def get_container(request: Request) -> ServiceContainer:
    return request.app.state.container


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    container: ServiceContainer = Depends(get_container),
) -> AppUser:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta token de acceso.")
    return container.auth.get_user_by_token(credentials.credentials)


@public_router.get("/password-setup/open", response_class=HTMLResponse)
def open_password_setup_link(request: Request) -> HTMLResponse:
    token = request.query_params.get("token", "").strip()
    email = request.query_params.get("email", "").strip().lower()
    deep_link = f"atelier://set-password?{urlencode({'token': token, 'email': email})}"
    html = f"""
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Abrir Atelier</title>
        <script>
          window.onload = function() {{
            window.location.href = "{deep_link}";
            setTimeout(function() {{
              var fallback = document.getElementById("fallback");
              if (fallback) fallback.style.display = "block";
            }}, 1200);
          }};
        </script>
      </head>
      <body style="margin:0;padding:32px;background:#111111;color:#efe6db;font-family:Georgia,serif;">
        <div style="max-width:560px;margin:0 auto;text-align:center;">
          <div style="color:#cda75f;font-size:13px;letter-spacing:0.4em;">ATELIER</div>
          <h1 style="margin:18px 0 12px 0;">Abriendo la app...</h1>
          <p style="line-height:1.7;color:#d5cabc;">
            Si Atelier no se abre automaticamente, toca el siguiente enlace para continuar con la creacion de tu contrasena.
          </p>
          <p id="fallback" style="display:none;margin-top:28px;">
            <a href="{deep_link}" style="color:#cda75f;font-size:18px;font-weight:700;text-decoration:underline;">
              Abrir Atelier y crear contrasena
            </a>
          </p>
        </div>
      </body>
    </html>
    """
    return HTMLResponse(content=html)


@api_router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@api_router.post("/auth/pre-register", response_model=RegistrationProgressResponse)
def pre_register(payload: PreRegisterRequest, container: ServiceContainer = Depends(get_container)) -> RegistrationProgressResponse:
    return container.auth.pre_register(payload)


@api_router.post("/auth/register-onboarding", response_model=MessageResponse)
def register_onboarding(
    payload: OnboardingRegistrationRequest,
    container: ServiceContainer = Depends(get_container),
) -> MessageResponse:
    return container.auth.register_onboarding(payload)


@api_router.post("/auth/complete-registration", response_model=AuthTokenResponse)
def complete_registration(
    payload: CompleteRegistrationRequest,
    container: ServiceContainer = Depends(get_container),
) -> AuthTokenResponse:
    return container.auth.complete_registration(payload)


@api_router.post("/auth/password-setup/complete", response_model=AuthTokenResponse)
def complete_password_setup(
    payload: PasswordSetupRequest,
    container: ServiceContainer = Depends(get_container),
) -> AuthTokenResponse:
    return container.auth.complete_password_setup(payload)


@api_router.post("/auth/login", response_model=AuthTokenResponse)
def login(payload: LoginRequest, container: ServiceContainer = Depends(get_container)) -> AuthTokenResponse:
    return container.auth.login(payload)


@api_router.post("/auth/password-reset/request", response_model=MessageResponse)
def request_password_reset(
    payload: PasswordResetRequest,
    container: ServiceContainer = Depends(get_container),
) -> MessageResponse:
    return container.auth.request_password_reset(payload)


@api_router.post("/auth/password-reset/confirm", response_model=MessageResponse)
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    container: ServiceContainer = Depends(get_container),
) -> MessageResponse:
    return container.auth.confirm_password_reset(payload)


@api_router.post("/auth/password/change", response_model=MessageResponse)
def change_password(
    payload: PasswordChangeRequest,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> MessageResponse:
    return container.auth.change_password(current_user, payload)


@api_router.get("/auth/profile", response_model=UserProfileResponse)
def profile(current_user: AppUser = Depends(get_current_user), container: ServiceContainer = Depends(get_container)) -> UserProfileResponse:
    return container.auth.get_profile(current_user)


@api_router.patch("/auth/profile/avatar", response_model=UserProfileResponse)
def update_profile_avatar(
    payload: ProfileAvatarUpdateRequest,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> UserProfileResponse:
    return container.auth.update_profile_avatar(current_user, payload)


@api_router.post("/auth/profile/avatar", response_model=UserProfileResponse)
def update_profile_avatar_post(
    payload: ProfileAvatarUpdateRequest,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> UserProfileResponse:
    return container.auth.update_profile_avatar(current_user, payload)


@api_router.patch("/auth/profile", response_model=UserProfileResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> UserProfileResponse:
    return container.auth.update_profile(current_user, payload)


@api_router.post("/auth/profile", response_model=UserProfileResponse)
def update_profile_post(
    payload: ProfileUpdateRequest,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> UserProfileResponse:
    return container.auth.update_profile(current_user, payload)


@api_router.get("/payment-methods", response_model=list[PaymentMethodResponse])
def list_payment_methods(
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> list[PaymentMethodResponse]:
    return container.auth.list_payment_methods(current_user)


@api_router.post("/payment-methods", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
def create_payment_method(
    payload: PaymentMethodCreate,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> PaymentMethodResponse:
    return container.auth.create_payment_method(current_user, payload)


@api_router.patch("/payment-methods/{payment_id}", response_model=PaymentMethodResponse)
def update_payment_method(
    payment_id: int,
    payload: PaymentMethodUpdate,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> PaymentMethodResponse:
    return container.auth.update_payment_method(current_user, payment_id, payload)


@api_router.delete("/payment-methods/{payment_id}", response_model=MessageResponse)
def delete_payment_method(
    payment_id: int,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> MessageResponse:
    return container.auth.delete_payment_method(current_user, payment_id)


@api_router.get("/subastas", response_model=list[AuctionSummaryResponse])
def list_auctions(current_user: AppUser = Depends(get_current_user), container: ServiceContainer = Depends(get_container)):
    return container.auctions.list_auctions(current_user)


@api_router.get("/catalogos-publicos", response_model=list[AuctionSummaryResponse])
def list_public_catalogs(container: ServiceContainer = Depends(get_container)) -> list[AuctionSummaryResponse]:
    return container.auctions.list_public_auctions()


@api_router.get("/catalogos-publicos/{auction_id}", response_model=AuctionDetailResponse)
def get_public_catalog(auction_id: int, container: ServiceContainer = Depends(get_container)) -> AuctionDetailResponse:
    return container.auctions.get_public_auction(auction_id)


@api_router.get("/watchlist", response_model=list[AuctionSummaryResponse])
def list_watchlist(
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> list[AuctionSummaryResponse]:
    return container.auctions.list_watchlist(current_user)


@api_router.post("/watchlist/{auction_id}", response_model=MessageResponse)
def add_to_watchlist(
    auction_id: int,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> MessageResponse:
    return container.auctions.add_to_watchlist(current_user, auction_id)


@api_router.delete("/watchlist/{auction_id}", response_model=MessageResponse)
def remove_from_watchlist(
    auction_id: int,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> MessageResponse:
    return container.auctions.remove_from_watchlist(current_user, auction_id)


@api_router.get("/subastas/activa", response_model=ActiveAuctionResponse | None)
def get_active_auction(
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
):
    return container.auctions.get_active_auction(current_user)


@api_router.get("/subastas/{auction_id}", response_model=AuctionDetailResponse)
def get_auction(auction_id: int, current_user: AppUser = Depends(get_current_user), container: ServiceContainer = Depends(get_container)):
    return container.auctions.get_auction(current_user, auction_id)


@api_router.post("/subastas/{auction_id}/join", response_model=JoinAuctionResponse)
def join_auction(
    auction_id: int,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> JoinAuctionResponse:
    return container.auctions.join_auction(current_user, auction_id)


@api_router.post("/subastas/{auction_id}/abandonar", response_model=LeaveAuctionResponse)
async def leave_auction(
    auction_id: int,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> LeaveAuctionResponse:
    return await container.auctions.leave_auction(current_user, auction_id)


@api_router.post("/subastas/{auction_id}/lotes/{lot_id}/pujas", response_model=BidResponse)
async def create_bid(
    auction_id: int,
    lot_id: int,
    payload: BidCreate,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> BidResponse:
    return await container.auctions.place_bid(current_user, auction_id, lot_id, payload)


@api_router.get("/notificaciones", response_model=list[NotificationResponse])
def list_notifications(
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> list[NotificationResponse]:
    return container.notifications.list_for_user(current_user.id)


@api_router.post("/notificaciones/{notification_id}/leida", response_model=MessageResponse)
def mark_notification_read(
    notification_id: int,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> MessageResponse:
    response = container.notifications.mark_read(current_user.id, notification_id)
    if response is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificacion no encontrada.")
    return response


@api_router.get("/mensajes", response_model=list[MessageThreadResponse])
def list_message_threads(
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> list[MessageThreadResponse]:
    return container.messages.list_for_user(current_user)


@api_router.get("/mensajes/{thread_id}", response_model=MessageThreadResponse)
def get_message_thread(
    thread_id: int,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> MessageThreadResponse:
    return container.messages.get_for_user(current_user, thread_id)


@api_router.post("/mensajes/{thread_id}", response_model=MessageThreadResponse)
def reply_message_thread(
    thread_id: int,
    payload: CorrespondenceMessageCreate,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> MessageThreadResponse:
    return container.messages.reply_as_user(current_user, thread_id, payload.body)


@api_router.post("/compras/{purchase_id}/coordinar-envio", response_model=MessageThreadResponse)
def open_purchase_shipping_chat(
    purchase_id: int,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> MessageThreadResponse:
    return container.messages.open_shipping_coordination(current_user, purchase_id)


@api_router.get("/metricas/personal", response_model=MetricsResponse)
def personal_metrics(
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> MetricsResponse:
    return container.metrics.get_personal_metrics(current_user)


@api_router.get("/historial", response_model=list[HistoryEntryResponse])
def history(
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> list[HistoryEntryResponse]:
    return container.metrics.get_history(current_user)


@api_router.get("/consignaciones", response_model=list[ConsignmentResponse])
def list_consignments(
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> list[ConsignmentResponse]:
    return container.consignments.list_for_user(current_user)


@api_router.post("/consignaciones", response_model=ConsignmentResponse, status_code=status.HTTP_201_CREATED)
def create_consignment(
    payload: ConsignmentCreate,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> ConsignmentResponse:
    return container.consignments.create(current_user, payload)


@api_router.post("/consignaciones/{consignment_id}/propuesta", response_model=ConsignmentResponse)
def decide_consignment_proposal(
    consignment_id: int,
    payload: ConsignmentProposalDecisionRequest,
    current_user: AppUser = Depends(get_current_user),
    container: ServiceContainer = Depends(get_container),
) -> ConsignmentResponse:
    return container.consignments.decide_proposal(
        current_user,
        consignment_id,
        payload.accept,
        payload.payout_account,
    )


@api_router.get("/admin/dashboard")
def admin_dashboard_api(container: ServiceContainer = Depends(get_container)):
    return container.admin.dashboard()


@api_router.get("/admin/mensajes", response_model=list[MessageThreadResponse])
def admin_list_message_threads(container: ServiceContainer = Depends(get_container)) -> list[MessageThreadResponse]:
    return container.messages.list_for_admin()


@api_router.post("/admin/mensajes/{thread_id}", response_model=MessageThreadResponse)
def admin_reply_message_thread(
    thread_id: int,
    payload: CorrespondenceMessageCreate,
    container: ServiceContainer = Depends(get_container),
) -> MessageThreadResponse:
    return container.messages.reply_as_company(thread_id, payload.body)


@api_router.post("/admin/clientes/{user_id}/approve", response_model=UserProfileResponse)
def admin_approve_user(
    user_id: int,
    payload: AdminUserApprovalRequest,
    container: ServiceContainer = Depends(get_container),
) -> UserProfileResponse:
    return container.admin.approve_user(user_id, payload.category)


@api_router.post("/admin/medios-pago/{payment_id}/verify", response_model=PaymentMethodResponse)
def admin_verify_payment(payment_id: int, container: ServiceContainer = Depends(get_container)) -> PaymentMethodResponse:
    return container.admin.verify_payment(payment_id)


@api_router.post("/admin/consignaciones/{consignment_id}/review", response_model=ConsignmentResponse)
def admin_review_consignment(
    consignment_id: int,
    payload: AdminConsignmentReviewRequest,
    container: ServiceContainer = Depends(get_container),
) -> ConsignmentResponse:
    return container.admin.review_consignment(consignment_id, payload)


@api_router.post("/admin/subastas")
def admin_create_auction(
    payload: AdminAuctionCreateRequest,
    container: ServiceContainer = Depends(get_container),
):
    return container.admin.create_auction(payload)


@api_router.post("/admin/subastas/{auction_id}/close")
def admin_close_auction(auction_id: int, container: ServiceContainer = Depends(get_container)):
    return container.admin.close_auction(auction_id)


@api_router.post("/admin/subastas/{auction_id}/current-lot/close")
def admin_close_current_lot(auction_id: int, container: ServiceContainer = Depends(get_container)):
    return container.admin.close_current_lot(auction_id)


@admin_router.get("", response_class=HTMLResponse)
@admin_router.get("/", response_class=HTMLResponse)
@admin_router.get("/dashboard", response_class=HTMLResponse)
def admin_dashboard_page(request: Request, container: ServiceContainer = Depends(get_container)) -> HTMLResponse:
    dashboard = container.admin.dashboard()
    return templates.TemplateResponse(
        request=request,
        name="admin/dashboard.html",
        context={
            "request": request,
            "dashboard": dashboard,
            "categories": list(UserCategory),
        },
    )


@admin_router.post("/users/{user_id}/approve")
def admin_dashboard_approve_user(
    user_id: int,
    category: str | None = Form(None),
    container: ServiceContainer = Depends(get_container),
):
    container.admin.approve_user(user_id, UserCategory(category) if category else UserCategory.COMUN)
    return RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_303_SEE_OTHER)


@admin_router.post("/payments/{payment_id}/verify")
def admin_dashboard_verify_payment(payment_id: int, container: ServiceContainer = Depends(get_container)):
    container.admin.verify_payment(payment_id)
    return RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_303_SEE_OTHER)


@admin_router.post("/consignments/{consignment_id}/review")
def admin_dashboard_review_consignment(
    consignment_id: int,
    approve: bool = Form(False),
    request_inspection: bool = Form(False),
    rejection_reason: str = Form(""),
    proposed_base_price: float | None = Form(None),
    commission_rate: float | None = Form(None),
    assigned_auction_id: int | None = Form(None),
    storage_location: str | None = Form(None),
    insurance_policy: str | None = Form(None),
    inspection_address: str | None = Form(None),
    return_shipping_cost: float | None = Form(None),
    return_shipping_note: str = Form(""),
    origin_doubt_reported: bool = Form(False),
    origin_doubt_notes: str = Form(""),
    container: ServiceContainer = Depends(get_container),
):
    container.admin.review_consignment(
        consignment_id,
        AdminConsignmentReviewRequest(
            approve=approve,
            request_inspection=request_inspection,
            rejection_reason=rejection_reason or None,
            proposed_base_price=proposed_base_price,
            commission_rate=commission_rate,
            assigned_auction_id=assigned_auction_id,
            storage_location=storage_location,
            insurance_policy=insurance_policy,
            inspection_address=inspection_address,
            return_shipping_cost=return_shipping_cost,
            return_shipping_note=return_shipping_note or None,
            origin_doubt_reported=origin_doubt_reported,
            origin_doubt_notes=origin_doubt_notes or None,
        ),
    )
    return RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_303_SEE_OTHER)


@admin_router.post("/messages/{thread_id}/reply")
def admin_dashboard_reply_message(
    thread_id: int,
    body: str = Form(""),
    container: ServiceContainer = Depends(get_container),
):
    container.messages.reply_as_company(thread_id, body)
    return RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_303_SEE_OTHER)


@admin_router.post("/subastas/{auction_id}/close")
def admin_dashboard_close_auction(auction_id: int, container: ServiceContainer = Depends(get_container)):
    container.admin.close_auction(auction_id)
    return RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_303_SEE_OTHER)


@admin_router.post("/subastas/{auction_id}/current-lot/close")
def admin_dashboard_close_current_lot(auction_id: int, container: ServiceContainer = Depends(get_container)):
    container.admin.close_current_lot(auction_id)
    return RedirectResponse(url="/admin/dashboard", status_code=status.HTTP_303_SEE_OTHER)


def attach_websocket(app: FastAPI) -> None:
    @app.websocket("/ws/subastas/{auction_id}")
    async def auction_socket(websocket: WebSocket, auction_id: int) -> None:
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4401)
            return
        container: ServiceContainer = websocket.app.state.container
        user: AppUser | None = None
        try:
            user = container.auth.get_user_by_token(token)
            container.auctions.join_auction(user, auction_id)
            await container.realtime.connect(auction_id, websocket)
            await websocket.send_json({"type": "connected", "auction_id": auction_id, "user_id": user.id})
            while True:
                message = await websocket.receive_json()
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
        except WebSocketDisconnect:
            container.realtime.disconnect(auction_id, websocket)
        except Exception:
            container.realtime.disconnect(auction_id, websocket)
            await websocket.close(code=4400)
        finally:
            if user and container.store.active_connections_by_user.get(user.id) == auction_id:
                container.store.active_connections_by_user.pop(user.id, None)
