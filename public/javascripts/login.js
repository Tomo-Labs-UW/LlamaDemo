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

    // TODO: Replace this placeholder with your Supabase auth call.
    // Example:
    // await supabase.auth.signInWithOAuth({ provider });
    await new Promise((resolve) => setTimeout(resolve, 250));

    setStatus(`Supabase ${provider} login is not connected yet.`, "pending");
  } catch (error) {
    setStatus(error?.message || "Sign in failed.", "error");
  }
};

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const provider = button.dataset.provider;
    if (!provider) return;
    handleProviderLogin(provider);
  });
});
