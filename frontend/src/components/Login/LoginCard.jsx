import { useState } from 'react';

export default function LoginCard() {
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState("");

  const handleProviderLogin = async (provider) => {
    try {
      setStatus("Starting sign in...");
      setStatusKind("");

      await new Promise((resolve) => setTimeout(resolve, 250));

      setStatus(`Supabase ${provider} login is not connected yet.`, "pending");
      setStatusKind("pending");
    } catch (error) {
      setStatus(error?.message || "Sign in failed.", "error");
      setStatusKind("error");
    }
  };

  return (
    <main className="container">
      <section className="card" id="login-section" aria-label="Login screen">
        <div className="window-titlebar">
          <a className="window-title login-brand" href="/" aria-label="TomoTube home">
            TomoTube
          </a>
          <span className="window-icon" aria-hidden="true"></span>
        </div>
        <section className="upload-stage login-stage" aria-labelledby="login-title">
          <div className="login-card">
            <h1 id="login-title">Login</h1>
            <div className="login-actions" role="group" aria-label="Login options">
              <button
                className="social-login-btn"
                type="button"
                onClick={() => handleProviderLogin("google")}
              >
                <span>Login with Google</span>
                <span className="social-logo google-logo" aria-hidden="true">G</span>
              </button>
              <button
                className="social-login-btn"
                type="button"
                onClick={() => handleProviderLogin("microsoft")}
              >
                <span>Login with Microsoft</span>
                <span className="social-logo microsoft-logo" aria-hidden="true">
                  <span></span><span></span><span></span><span></span>
                </span>
              </button>
            </div>
            <p className={`login-status ${statusKind}`.trim()} aria-live="polite">
              {status}
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
