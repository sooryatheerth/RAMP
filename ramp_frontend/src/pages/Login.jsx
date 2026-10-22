import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // If the user came from a protected page, redirect back there after login
  const from = location.state?.from?.pathname;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const loggedInUser = await login(form.username, form.password);

      // Determine where to send the user
      if (from) {
        navigate(from, { replace: true });
      } else if (loggedInUser && (loggedInUser.is_staff || loggedInUser.user_type === "admin")) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/places", { replace: true });
      }
    } catch (err) {
      setError("Username or password is incorrect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ padding: "4rem 1.25rem", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        className="card"
        style={{
          width: "100%",
          padding: "2.25rem 2rem",
          boxShadow: "var(--shadow-md)",
          border: "1.5px solid var(--color-border)",
          background: "#FFFFFF",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "14px",
              background: "var(--color-primary-gradient)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: "1.4rem",
              fontWeight: 800,
              boxShadow: "0 4px 14px rgba(15, 118, 110, 0.3)",
              marginBottom: "0.85rem",
            }}
          >
            ♿
          </div>
          <h1 style={{ fontSize: "1.65rem", margin: "0 0 0.3rem" }}>Welcome back</h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
            Log in to tag places and earn contributor reputation
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              required
              autoComplete="username"
              placeholder="e.g. alex_ramper"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                background: "var(--color-danger-light)",
                border: "1px solid var(--color-danger-border)",
                borderRadius: "var(--radius)",
                marginBottom: "1rem",
              }}
            >
              <p className="error-text" role="alert" style={{ margin: 0 }}>
                {error}
              </p>
            </div>
          )}
          <button className="btn-primary" type="submit" disabled={busy} style={{ width: "100%", padding: "0.75em" }}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", textAlign: "center", borderTop: "1px solid var(--color-border)", paddingTop: "1.2rem" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
            New to RAMP?{" "}
            <Link to="/register" style={{ fontWeight: 700 }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
