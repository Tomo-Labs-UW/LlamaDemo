import { createClient } from "@supabase/supabase-js";
import ws from "ws";

export function normalizeSupabaseUrl(value = "") {
  const trimmedValue = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmedValue) return "";

  const dashboardMatch = trimmedValue.match(
    /^https:\/\/supabase\.com\/dashboard\/project\/([a-z0-9-]+)$/i
  );
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  return trimmedValue;
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_OUTPUTS_TABLE = String(process.env.SUPABASE_OUTPUTS_TABLE || "saved_outputs").trim();

export const publicSupabaseConfig =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
      }
    : null;

const supabaseAuthClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          transport: ws,
        },
      })
    : null;

const supabaseAdminClient =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          transport: ws,
        },
      })
    : null;

export async function getUserFromAccessToken(accessToken = "") {
  const token = String(accessToken || "").trim();
  if (!supabaseAuthClient || !token) return null;

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error) {
    console.warn("Supabase token verification failed.", error.message);
    return null;
  }

  return data?.user || null;
}

export async function saveGeneratedOutput({
  userId,
  userEmail,
  sourceText,
  simplifiedText,
  title,
  author,
  fileName,
  sourceType,
  outputLength,
  tone,
  thumbnailData,
}) {
  if (!supabaseAdminClient) {
    return { saved: false, reason: "Supabase admin client is not configured." };
  }
  if (!userId) {
    return { saved: false, reason: "No user ID was provided." };
  }

  const safeTitle =
    String(title || "").trim() ||
    String(fileName || "").trim() ||
    String(sourceType === "text" ? "Manual Text Entry" : "Saved Reading").trim();
  const safeOutputText = String(simplifiedText || sourceText || "").trim();
  if (!safeOutputText) {
    return { saved: false, reason: "No output text was provided." };
  }

  const payload = {
    user_id: userId,
    title: safeTitle,
    output_text: safeOutputText,
  };
  const normalizedThumbnailData = String(thumbnailData || "").trim();
  if (sourceType === "pdf" && normalizedThumbnailData) {
    payload.thumbnail_data = normalizedThumbnailData;
  }

  let { data, error } = await supabaseAdminClient
    .from(SUPABASE_OUTPUTS_TABLE)
    .insert(payload)
    .select("id")
    .single();

  if (error && error.code === "PGRST204" && /thumbnail_data/i.test(error.message || "")) {
    delete payload.thumbnail_data;
    ({ data, error } = await supabaseAdminClient
      .from(SUPABASE_OUTPUTS_TABLE)
      .insert(payload)
      .select("id")
      .single());
  }

  if (error) {
    console.warn(`Supabase save failed for table "${SUPABASE_OUTPUTS_TABLE}".`, error.message);
    return { saved: false, reason: error.message };
  }

  return { saved: true, id: data?.id ?? null };
}

export async function listGeneratedOutputs(userId, limit = 12) {
  if (!supabaseAdminClient) {
    return { outputs: [], reason: "Supabase admin client is not configured." };
  }
  if (!userId) {
    return { outputs: [], reason: "No user ID was provided." };
  }

  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 12));
  const { data, error } = await supabaseAdminClient
    .from(SUPABASE_OUTPUTS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.warn(`Supabase read failed for table "${SUPABASE_OUTPUTS_TABLE}".`, error.message);
    return { outputs: [], reason: error.message };
  }

  return { outputs: Array.isArray(data) ? data : [], reason: "" };
}
