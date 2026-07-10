import { createClient } from "https://esm.sh/@supabase/supabase-js@2?bundle";

const LOCAL_CONFIG_ENDPOINT = "http://localhost:3001/api/config";

let supabaseClientPromise = null;

const getApiBaseUrl = () => {
  const runtimeApiUrl = typeof window.API_URL === "string" ? window.API_URL.trim() : "";
  return runtimeApiUrl.replace(/\/+$/, "");
};

const getConfigEndpoint = () => {
  const apiBaseUrl = getApiBaseUrl();
  return apiBaseUrl ? `${apiBaseUrl}/api/config` : "/api/config";
};

const canUseLocalFallback = () =>
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

async function fetchSupabaseConfig() {
  try {
    const response = await fetch(getConfigEndpoint(), { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `Config request failed (${response.status}).`);
    }
    return data;
  } catch (error) {
    if (!canUseLocalFallback()) throw error;

    const response = await fetch(LOCAL_CONFIG_ENDPOINT, { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `Config request failed (${response.status}).`);
    }
    return data;
  }
}

export async function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = fetchSupabaseConfig().then((config) => {
      if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
        throw new Error("Supabase public config is missing.");
      }

      return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      });
    });
  }

  return supabaseClientPromise;
}

export async function getSupabaseSession() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function getSupabaseAccessToken() {
  const session = await getSupabaseSession();
  return session?.access_token || "";
}

export async function getSupabaseUser() {
  const session = await getSupabaseSession();
  return session?.user || null;
}
