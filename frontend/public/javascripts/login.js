import { getSupabaseClient, getSupabaseUser } from "./supabaseClient.js";

const statusEl = document.getElementById("login-status");
const buttons = document.querySelectorAll(".social-login-btn");

const setStatus = (message, kind = "") => {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `login-status ${kind}`.trim();
};

const handleProviderLogin = async (provider) => {
  try {
    setStatus("Starting sign in...");
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/index.html`,
      },
    });
    if (error) throw error;
  } catch (error) {
    setStatus(error?.message || "Sign in failed.", "error");
  }
};

const redirectIfAlreadyLoggedIn = async () => {
  try {
    const user = await getSupabaseUser();
    if (user) {
      window.location.replace("index.html");
    }
  } catch (error) {
    setStatus(error?.message || "Could not read login session.", "error");
  }
};

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const provider = button.dataset.provider;
    if (!provider) return;
    handleProviderLogin(provider);
  });
});

redirectIfAlreadyLoggedIn();
