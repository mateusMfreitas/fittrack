import type { SyncRequest, SyncResponse } from "../../shared/collections";

export class NetworkError extends Error {}
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "same-origin",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });
  } catch {
    throw new NetworkError("Sem conexão com o servidor.");
  }
  // Offline com service worker: a navegação cai no index.html, que não é JSON.
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!res.ok) {
    const body = isJson ? await res.json().catch(() => null) : null;
    throw new HttpError(res.status, body?.error ?? `Erro ${res.status}`);
  }
  if (!isJson) throw new NetworkError("Resposta inesperada do servidor.");
  return res.json() as Promise<T>;
}

export const api = {
  me: () => request<{ ok: true }>("/auth/me"),
  login: (password: string) =>
    request<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  sync: (body: SyncRequest) => request<SyncResponse>("/sync", { method: "POST", body: JSON.stringify(body) }),
};
