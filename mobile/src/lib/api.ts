import {
  ActiveAuction,
  ApiMessage,
  AuctionDetail,
  AuctionSummary,
  AuthPayload,
  BidResponse,
  CompleteRegistrationPayload,
  Consignment,
  JoinAuctionResult,
  LeaveAuctionResult,
  Metrics,
  NotificationItem,
  PaymentMethod,
  PaymentMethodCreatePayload,
  ProfileUpdatePayload,
  PreRegisterPayload,
  RegistrationProgress,
  UserProfile
} from "./types";
import { Platform } from "react-native";

function normalizeApiBaseUrl(value?: string) {
  return value?.replace(/\/$/, "");
}

function normalizeAndroidHost(value?: string) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) {
    return normalized;
  }
  return normalized
    .replace("://127.0.0.1", "://10.0.2.2")
    .replace("://localhost", "://10.0.2.2");
}

function resolveApiBaseUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${window.location.hostname}:8000/api/v1`;
  }

  if (Platform.OS === "android") {
    return (
      normalizeAndroidHost(process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID) ??
      normalizeAndroidHost(process.env.EXPO_PUBLIC_API_BASE_URL) ??
      "http://10.0.2.2:8000/api/v1"
    );
  }

  return normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
}

const API_BASE_URL = resolveApiBaseUrl();
const REQUEST_TIMEOUT_MS = 12000;

function parseErrorDetail(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Error inesperado";
  }

  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const message = detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") {
          return item.msg;
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");

    if (message) {
      return message;
    }
  }

  return "Error inesperado";
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("La app no tiene configurada una API real. Define EXPO_PUBLIC_API_BASE_URL para guardar en base de datos.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ detail: "Error inesperado" }));
      throw new Error(parseErrorDetail(data));
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("No pudimos conectar con el servidor. Verifica tu conexion y vuelve a intentar.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function login(email: string, password: string) {
  return request<AuthPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function requestPasswordReset(email: string) {
  return request<ApiMessage>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export function confirmPasswordReset(email: string, code: string, newPassword: string) {
  return request<ApiMessage>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ email, code, new_password: newPassword })
  });
}

export function preRegister(payload: PreRegisterPayload) {
  return request<RegistrationProgress>("/auth/pre-register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function completeRegistration(payload: CompleteRegistrationPayload) {
  return request<AuthPayload>("/auth/complete-registration", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getProfile(token: string) {
  return request<AuthPayload["user"]>("/auth/profile", {}, token);
}

export function updateProfileAvatar(token: string, avatarImageUrl: string) {
  return request<UserProfile>(
    "/auth/profile/avatar",
    {
      method: "PATCH",
      body: JSON.stringify({ avatar_image_url: avatarImageUrl })
    },
    token
  );
}

export function updateProfile(token: string, payload: ProfileUpdatePayload) {
  return request<UserProfile>(
    "/auth/profile",
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function listAuctions(token: string) {
  return request<AuctionSummary[]>("/subastas", {}, token);
}

export function getAuction(token: string, auctionId: number) {
  return request<AuctionDetail>(`/subastas/${auctionId}`, {}, token);
}

export function getActiveAuction(token: string) {
  return request<ActiveAuction | null>("/subastas/activa", {}, token);
}

export function joinAuction(token: string, auctionId: number) {
  return request<JoinAuctionResult>(`/subastas/${auctionId}/join`, { method: "POST" }, token);
}

export function leaveAuction(token: string, auctionId: number) {
  return request<LeaveAuctionResult>(`/subastas/${auctionId}/abandonar`, { method: "POST" }, token);
}

export function placeBid(token: string, auctionId: number, lotId: number, amount: number) {
  return request<BidResponse>(
    `/subastas/${auctionId}/lotes/${lotId}/pujas`,
    {
      method: "POST",
      body: JSON.stringify({ amount })
    },
    token
  );
}

export function listNotifications(token: string) {
  return request<NotificationItem[]>("/notificaciones", {}, token);
}

export function getMetrics(token: string) {
  return request<Metrics>("/metricas/personal", {}, token);
}

export function listPaymentMethods(token: string) {
  return request<PaymentMethod[]>("/payment-methods", {}, token);
}

export function createPaymentMethod(token: string, payload: PaymentMethodCreatePayload) {
  return request<PaymentMethod>(
    "/payment-methods",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function updatePaymentMethod(token: string, paymentId: number, payload: PaymentMethodCreatePayload) {
  return request<PaymentMethod>(
    `/payment-methods/${paymentId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function deletePaymentMethod(token: string, paymentId: number) {
  return request<ApiMessage>(`/payment-methods/${paymentId}`, { method: "DELETE" }, token);
}

export function listConsignments(token: string) {
  return request<Consignment[]>("/consignaciones", {}, token);
}

export function createConsignment(
  token: string,
  payload: {
    title: string;
    description: string;
    story?: string;
    photos: string[];
  }
) {
  return request<Consignment>(
    "/consignaciones",
    {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        declared_ownership: true,
        declared_legal_origin: true
      })
    },
    token
  );
}
