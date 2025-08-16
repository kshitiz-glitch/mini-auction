// frontend/src/api.js
// Unified API helpers used across the app

// --- small helper: parse JSON + surface API errors consistently
const J = async (res) => {
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : null;
  if (!res.ok || (data && data.ok === false)) {
    throw new Error(data?.error || res.statusText);
  }
  return data ?? { ok: true };
};

// --- small helper: attach token + content-type when needed
const authHeaders = (token, extra = {}) => {
  const h = { ...extra };
  if (!h["Content-Type"] && typeof extra.body === "string") {
    h["Content-Type"] = "application/json";
  }
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

/* ===========================
 * Auth / Profile
 * =========================== */
export const login = (handle, pin) =>
  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, pin }),
  }).then(J);

export const getMe = (token) =>
  fetch("/me", { headers: authHeaders(token) }).then(J);

export const updateEmail = (email, token) =>
  fetch("/me/email", {
    method: "PUT",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ email }),
  }).then(J);

export const updatePin = (pin, token) =>
  fetch("/me/pin", {
    method: "PUT",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ pin }),
  }).then(J);

/* ===========================
 * Users (for auth dropdowns etc.)
 * =========================== */
export const getUsers = () => fetch("/users").then(J);

/* ===========================
 * Auctions (list/detail)
 * =========================== */
export const listAuctions = () => fetch("/auctions").then(J);

export const getAuction = (id) => fetch(`/auctions/${id}`).then(J);

// seller “End now”
export const closeAuction = (id, token) =>
  fetch(`/auctions/${id}/close`, {
    method: "POST",
    headers: authHeaders(token),
  }).then(J);

/* ===========================
 * Bids / Pricing / Decisions
 * =========================== */
export const getHighest = (id) => fetch(`/auctions/${id}/highest`).then(J);

export const getNextMin = (id) => fetch(`/auctions/${id}/next-min`).then(J);

export const getDecision = (id) => fetch(`/auctions/${id}/decision`).then(J);

export const getBids = (id) => fetch(`/auctions/${id}/bids`).then(J);

export const placeBid = (id, amount, token) =>
  fetch(`/bids`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ auction_id: id, amount }),
  }).then(J);

export const postDecision = (id, body, token) =>
  fetch(`/auctions/${id}/decision`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  }).then(J);

export const postAckCounter = (id, body, token) =>
  fetch(`/auctions/${id}/counter/ack`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  }).then(J);

/* ===========================
 * Invoice
 * =========================== */
export const getInvoice = (id) => fetch(`/auctions/${id}/invoice`).then(J);

export const emailInvoice = (id, token) =>
  fetch(`/auctions/${id}/invoice/email`, {
    method: "POST",
    headers: authHeaders(token),
  }).then(J);

  // Create a new auction (seller only)
export const createAuction = (payload, token) =>
  fetch("/auctions", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  }).then(J);
