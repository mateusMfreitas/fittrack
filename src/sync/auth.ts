import { useSyncExternalStore } from "react";
import { clearLocalData } from "../db/repo";
import { api } from "./api";
import { syncNow } from "./syncEngine";

export type AuthState = "loading" | "in" | "out";

// Marca local de "este aparelho já fez login": permite abrir o app offline.
const FLAG = "ft_logged";

let state: AuthState = "loading";
const subs = new Set<() => void>();
const set = (next: AuthState) => {
  state = next;
  subs.forEach((fn) => fn());
};

const readFlag = () => {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {
    /* armazenamento indisponível */
  }
};

export async function checkAuth(): Promise<void> {
  try {
    await api.me();
    writeFlag(true);
    set("in");
  } catch {
    // Sem rede ou sessão expirada: quem já entrou neste aparelho segue com os dados
    // locais, e o sync pede login quando precisar.
    set(readFlag() ? "in" : "out");
  }
}

export async function login(password: string): Promise<void> {
  await api.login(password);
  writeFlag(true);
  set("in");
  void syncNow();
}

export async function logout(): Promise<void> {
  await api.logout().catch(() => undefined);
  await clearLocalData();
  writeFlag(false);
  set("out");
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => state,
  );
}
