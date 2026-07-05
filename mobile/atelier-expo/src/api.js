const rawBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/v1$/, '');

function extractError(data, fallback) {
  if (!data) {
    return fallback;
  }
  if (typeof data === 'string') {
    return data;
  }
  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg || item.message || String(item)).join('\n');
  }
  return data.detail || data.message || fallback;
}

export async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(extractError(data, 'No pudimos conectar con el servidor.'));
  }

  return data;
}

export const api = {
  login: (email, password) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  profile: (token) => apiRequest('/auth/profile', { token }),
  updateProfile: (token, payload) =>
    apiRequest('/auth/profile', {
      method: 'POST',
      token,
      body: payload,
    }),
  updateAvatar: (token, avatarImageUrl) =>
    apiRequest('/auth/profile/avatar', {
      method: 'POST',
      token,
      body: { avatar_image_url: avatarImageUrl },
    }),
  auctions: (token) => apiRequest('/subastas', { token }),
  auctionDetail: (token, auctionId) => apiRequest(`/subastas/${auctionId}`, { token }),
  joinAuction: (token, auctionId) =>
    apiRequest(`/subastas/${auctionId}/join`, {
      method: 'POST',
      token,
      body: {},
    }),
  leaveAuction: (token, auctionId) =>
    apiRequest(`/subastas/${auctionId}/abandonar`, {
      method: 'POST',
      token,
      body: {},
    }),
  bid: (token, auctionId, lotId, amount) =>
    apiRequest(`/subastas/${auctionId}/lotes/${lotId}/pujas`, {
      method: 'POST',
      token,
      body: { amount },
    }),
  activeAuction: (token) => apiRequest('/subastas/activa', { token }),
  watchlist: (token) => apiRequest('/watchlist', { token }),
  addWatchlist: (token, auctionId) =>
    apiRequest(`/watchlist/${auctionId}`, {
      method: 'POST',
      token,
      body: {},
    }),
  removeWatchlist: (token, auctionId) =>
    apiRequest(`/watchlist/${auctionId}`, {
      method: 'DELETE',
      token,
    }),
  notifications: (token) => apiRequest('/notificaciones', { token }),
  paymentMethods: (token) => apiRequest('/payment-methods', { token }),
  deletePaymentMethod: (token, paymentId) =>
    apiRequest(`/payment-methods/${paymentId}`, {
      method: 'DELETE',
      token,
    }),
  createPaymentMethod: (token, payload) =>
    apiRequest('/payment-methods', {
      method: 'POST',
      token,
      body: payload,
    }),
};
