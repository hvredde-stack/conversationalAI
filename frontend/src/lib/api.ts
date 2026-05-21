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
  is_platform_admin: boolean;
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

// --- Documents (knowledge base) --------------------------------------------

export interface DocumentRecord {
  id: string;
  business_id: string;
  uploaded_by_uid: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  gcs_path: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  error: string | null;
  created_at: string;
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const res = await authedFetch("/api/documents");
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  const data = await res.json();
  return data.documents as DocumentRecord[];
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteDocument(docId: string): Promise<void> {
  const res = await authedFetch(`/api/documents/${docId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed: ${res.status}`);
  }
}

// --- Platform admin --------------------------------------------------------

export interface TenantSummary {
  business_id: string;
  name: string;
  owner_uid: string;
  owner_email: string | null;
  created_at: string;
  data_store_id: string | null;
  data_store_ready: boolean;
  user_count: number;
  document_count: number;
}

export async function listTenants(): Promise<TenantSummary[]> {
  const res = await authedFetch("/api/platform/tenants");
  if (!res.ok) throw new Error(`List tenants failed: ${res.status}`);
  const data = await res.json();
  return data.tenants as TenantSummary[];
}

export async function fetchTenantDetail(businessId: string): Promise<{
  tenant: TenantSummary;
  users: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
}> {
  const res = await authedFetch(`/api/platform/tenants/${businessId}`);
  if (!res.ok) throw new Error(`Tenant detail failed: ${res.status}`);
  return res.json();
}
