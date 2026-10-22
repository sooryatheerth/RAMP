import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthAPI } from "../api/client";

const PROFILE_OPTIONS = [
  { code: "wheelchair", label: "Wheelchair user" },
  { code: "visual", label: "Visually impaired" },
  { code: "hearing", label: "Hearing impaired" },
  { code: "elderly", label: "Elderly / limited stamina" },
  { code: "temporary", label: "Temporary mobility challenge" },
];

export default function Register() {
  const { register, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleProfile(code) {
    setProfiles((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      if (profiles.length) {
        const { data } = await AuthAPI.updateMe({ accessibility_profile_codes: profiles });
        setUser(data);
      }
      navigate("/places");
    } catch (err) {
      const detail = err.response?.data;
      setError(
        detail
          ? Object.values(detail).flat().join(" ")
          : "Something went wrong creating your account."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ padding: "3.5rem 1.25rem", maxWidth: 520, display: "flex", flexDirection: "column", alignItems: "center" }}>
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
          <h1 style={{ fontSize: "1.65rem", margin: "0 0 0.3rem" }}>Create your account</h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
            Join the community mapping accessible spaces worldwide
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              required
              placeholder="e.g. accessibility_champion"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <fieldset
            className="field"
            style={{
              border: "1.5px solid var(--color-border)",
              borderRadius: "var(--radius)",
              padding: "0.9em 1.1em",
              background: "var(--color-surface-hover)",
            }}
          >
            <legend style={{ fontWeight: 700, fontSize: "0.88rem", padding: "0 0.4em", color: "var(--color-text)" }}>
              Accessibility Profile <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
            </legend>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.6rem" }}>
              Tailors search results and verified feature filters to your mobility preferences:
            </p>
            {PROFILE_OPTIONS.map((opt) => (
              <label
                key={opt.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6em",
                  fontWeight: 500,
                  fontSize: "0.9rem",
                  marginBottom: "0.45em",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={profiles.includes(opt.code)}
                  onChange={() => toggleProfile(opt.code)}
                  style={{ width: "auto", accentColor: "var(--color-primary)" }}
                />
                {opt.label}
              </label>
            ))}
          </fieldset>

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
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", textAlign: "center", borderTop: "1px solid var(--color-border)", paddingTop: "1.2rem" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ fontWeight: 700 }}>
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
