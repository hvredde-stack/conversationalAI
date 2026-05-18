import { auth } from "./firebase";

const BASE_URL = import.meta.env.VITE_BACKEND_URL;
export const WS_BASE_URL = import.meta.env.VITE_BACKEND_WS_URL;

async function authedFetch(path: string, init: RequestInit = {}, forceRefresh = false): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken(forceRefresh);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${BASE_URL}${path}`, { ...init, headers });
}

export interface MeResponse {
  uid: string;
  email: string | null;
  business_id: string | null;
  role: "owner" | "admin" | "manager" | "staff" | "customer" | null;
  needs_onboarding: boolean;
}

export async function fetchMe(forceRefresh = false): Promise<MeResponse> {
  const res = await authedFetch("/api/auth/me", {}, forceRefresh);
  if (!res.ok) throw new Error(`/api/auth/me failed: ${res.status}`);
  return res.json();
}

export async function createBusiness(name: string): Promise<MeResponse> {
  const res = await authedFetch("/api/businesses", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to create business: ${detail}`);
  }
  // Force a token refresh so the new custom claims (business_id, role=owner)
  // appear in subsequent requests.
  return fetchMe(true);
}

export async function getIdTokenForWs(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}
