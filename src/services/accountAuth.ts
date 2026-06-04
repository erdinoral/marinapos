import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { getMarinaApi } from "../api/marinaClient";
import type { AccountAuthConfig, AccountUser } from "../types/account";

declare const __MARINA_SUPABASE_URL__: string;
declare const __MARINA_SUPABASE_ANON_KEY__: string;

let client: SupabaseClient | null = null;
let clientKey = "";

function readSupabasePublicConfigFromBuild(): AccountAuthConfig | null {
  const url = String(typeof __MARINA_SUPABASE_URL__ !== "undefined" ? __MARINA_SUPABASE_URL__ : "").trim();
  const anonKey = String(typeof __MARINA_SUPABASE_ANON_KEY__ !== "undefined" ? __MARINA_SUPABASE_ANON_KEY__ : "").trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

async function resolveAuthConfig(): Promise<AccountAuthConfig | null> {
  try {
    const fromMain = await getMarinaApi().getAccountAuthConfig();
    if (fromMain?.url?.trim() && fromMain.anonKey?.trim()) {
      return { url: fromMain.url.trim(), anonKey: fromMain.anonKey.trim() };
    }
  } catch {
    /* Vite / tarayici veya API yok */
  }
  return readSupabasePublicConfigFromBuild();
}

function ensureClient(cfg: AccountAuthConfig): SupabaseClient {
  const key = `${cfg.url}\0${cfg.anonKey}`;
  if (client && clientKey === key) return client;
  clientKey = key;
  client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: typeof localStorage !== "undefined" ? localStorage : undefined
    }
  });
  return client;
}

export async function isAccountAuthConfigured(): Promise<boolean> {
  const cfg = await resolveAuthConfig();
  return Boolean(cfg?.url && cfg.anonKey);
}

export async function getAccountAuthClient(): Promise<SupabaseClient | null> {
  const cfg = await resolveAuthConfig();
  if (!cfg?.url || !cfg.anonKey) {
    client = null;
    clientKey = "";
    return null;
  }
  return ensureClient(cfg);
}

function sessionToUser(session: Session): AccountUser {
  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  const displayName =
    String(meta?.display_name ?? meta?.full_name ?? meta?.name ?? "").trim() ||
    session.user.email?.split("@")[0] ||
    "Kullanici";
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    displayName,
    createdAt: session.user.created_at ?? new Date().toISOString()
  };
}

export async function getAccountSession(): Promise<AccountUser | null> {
  const supabase = await getAccountAuthClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session ? sessionToUser(data.session) : null;
}

export function subscribeAccountAuth(onChange: (user: AccountUser | null) => void): () => void {
  let cancelled = false;
  let unsub: (() => void) | undefined;
  void getAccountAuthClient().then((supabase) => {
    if (cancelled) return;
    if (!supabase) {
      onChange(null);
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      onChange(session ? sessionToUser(session) : null);
    });
    unsub = () => data.subscription.unsubscribe();
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export async function signInAccount(email: string, password: string): Promise<AccountUser> {
  const supabase = await getAccountAuthClient();
  if (!supabase) throw new Error("Hesap servisi yapilandirilmamis.");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Oturum acilamadi.");
  return sessionToUser(data.session);
}

export async function signUpAccount(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ user: AccountUser | null; needsEmailConfirmation: boolean }> {
  const supabase = await getAccountAuthClient();
  if (!supabase) throw new Error("Hesap servisi yapilandirilmamis.");
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: { display_name: input.displayName.trim() }
    }
  });
  if (error) throw new Error(error.message);
  if (data.session) {
    return { user: sessionToUser(data.session), needsEmailConfirmation: false };
  }
  return { user: null, needsEmailConfirmation: true };
}

export async function signOutAccount(): Promise<void> {
  const supabase = await getAccountAuthClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function signOutAllDevices(): Promise<void> {
  const supabase = await getAccountAuthClient();
  if (!supabase) throw new Error("Hesap servisi yapilandirilmamis.");
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw new Error(error.message);
}

export type AccountSecurityInfo = {
  emailConfirmed: boolean;
  lastSignInAt: string | null;
};

export async function getAccountSecurityInfo(): Promise<AccountSecurityInfo | null> {
  const supabase = await getAccountAuthClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return {
    emailConfirmed: Boolean(data.user.email_confirmed_at),
    lastSignInAt: data.user.last_sign_in_at ?? null
  };
}

export async function changeAccountPassword(newPassword: string): Promise<void> {
  const supabase = await getAccountAuthClient();
  if (!supabase) throw new Error("Hesap servisi yapilandirilmamis.");
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Yeni sifre en az 6 karakter olmali.");
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function updateAccountProfile(patch: { displayName: string }): Promise<AccountUser> {
  const supabase = await getAccountAuthClient();
  if (!supabase) throw new Error("Hesap servisi yapilandirilmamis.");
  const name = patch.displayName.trim();
  const { data, error } = await supabase.auth.updateUser({
    data: { display_name: name }
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Profil guncellenemedi.");
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) return sessionToUser(sessionData.session);
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    displayName: name,
    createdAt: data.user.created_at ?? new Date().toISOString()
  };
}
