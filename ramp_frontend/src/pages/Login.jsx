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
    <main className="container" style={{ padding: "3rem 1.25rem", maxWidth: 420 }}>
      <h1>Log in</h1>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            required
            autoComplete="username"
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
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: "1.2rem" }}>
        New here? <Link to="/register">Create an account</Link>
      </p>
    </main>
  );
}
