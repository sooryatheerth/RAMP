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
    <main className="container" style={{ padding: "3rem 1.25rem", maxWidth: 480 }}>
      <h1>Create an account</h1>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            required
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
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <fieldset className="field" style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: "0.8em" }}>
          <legend style={{ fontWeight: 600, padding: "0 0.3em" }}>
            Accessibility profile <span className="muted" style={{ fontWeight: 400 }}>(optional, choose any that apply)</span>
          </legend>
          {PROFILE_OPTIONS.map((opt) => (
            <label key={opt.code} style={{ display: "flex", alignItems: "center", gap: "0.5em", fontWeight: 400, marginBottom: "0.4em" }}>
              <input
                type="checkbox"
                checked={profiles.includes(opt.code)}
                onChange={() => toggleProfile(opt.code)}
                style={{ width: "auto" }}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>

        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: "1.2rem" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  );
}
