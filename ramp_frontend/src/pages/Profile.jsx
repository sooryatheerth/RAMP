import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfidenceBadge from "../components/ConfidenceBadge";

const S = {
  page: { maxWidth: 860, margin: "0 auto", padding: "2rem 1.25rem" },
  section: {
    background: "#fff",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    padding: "1.5rem",
    marginBottom: "1.5rem",
    boxShadow: "var(--shadow)",
  },
  sectionTitle: { margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--color-primary-dark)" },
  avatar: {
    width: 64, height: 64, borderRadius: "50%",
    background: "var(--color-primary)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "1.6rem", fontWeight: 700, flexShrink: 0,
  },
  badge: (type) => ({
    display: "inline-block",
    padding: "0.2em 0.65em",
    borderRadius: 999,
    fontSize: "0.8rem",
    fontWeight: 700,
    background: type === "admin" ? "#fde8e8" : type === "moderator" ? "#e8f0fd" : "var(--color-primary-light)",
    color: type === "admin" ? "var(--color-danger)" : type === "moderator" ? "#1a4db5" : "var(--color-primary-dark)",
  }),
  input: { width: "100%", marginTop: "0.3rem" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  placeCard: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0.75rem 1rem", borderRadius: 8,
    border: "1px solid var(--color-border)", marginBottom: "0.5rem",
  },
};

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "" });
  const [saving, setSaving] = useState(false);

  // Change password state
  const [pwForm, setPwForm] = useState({ old_password: "", new_password: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  // My places
  const [myPlaces, setMyPlaces] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(true);

  // My attributes
  const [myAttrs, setMyAttrs] = useState([]);
  const [attrsLoading, setAttrsLoading] = useState(true);

  useEffect(() => {
    if (user) setForm({ first_name: user.first_name || "", last_name: user.last_name || "", email: user.email || "" });
  }, [user]);

  useEffect(() => {
    AuthAPI.myPlaces()
      .then((r) => setMyPlaces(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setPlacesLoading(false));
    AuthAPI.myAttributes()
      .then((r) => setMyAttrs(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setAttrsLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await AuthAPI.updateMe(form);
      setUser((u) => ({ ...u, ...data }));
      toast.success("Profile updated successfully.");
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (pwForm.new_password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    try {
      await AuthAPI.changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password });
      toast.success("Password changed successfully.");
      setPwForm({ old_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  }

  if (!user) return null;

  return (
    <main style={S.page}>
      <h1 style={{ marginBottom: "1.5rem" }}>My Profile</h1>

      {/* ── Identity card ── */}
      <div style={S.section}>
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
          <div style={S.avatar}>{user.username[0].toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>{user.username}</h2>
              <span style={S.badge(user.user_type)}>{user.user_type}</span>
              {user.is_verified_email
                ? <span style={{ color: "var(--color-primary-dark)", fontSize: "0.82rem", fontWeight: 600 }}>✓ Email verified</span>
                : <span style={{ color: "var(--color-warn)", fontSize: "0.82rem" }}>⚠ Email not verified</span>
              }
            </div>
            <p className="muted" style={{ margin: "0.3rem 0 0", fontSize: "0.9rem" }}>{user.email}</p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
              Reputation: <strong>{user.reputation_score}</strong> pts
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setEditing((e) => !e)} style={{ flexShrink: 0 }}>
            {editing ? "Cancel" : "✏ Edit"}
          </button>
        </div>

        {editing && (
          <form onSubmit={handleSave} style={{ marginTop: "1.25rem", borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem" }}>
            <div style={S.row}>
              <div className="field">
                <label htmlFor="p-first">First name</label>
                <input id="p-first" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="p-last">Last name</label>
                <input id="p-last" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="p-email">Email address</label>
              <input id="p-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
              <button className="btn-secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* ── Change password ── */}
      <div style={S.section}>
        <h3 style={S.sectionTitle}>🔒 Change Password</h3>
        <form onSubmit={handlePasswordChange}>
          <div className="field">
            <label htmlFor="pw-old">Current password</label>
            <input id="pw-old" type="password" value={pwForm.old_password} required
              onChange={(e) => setPwForm((f) => ({ ...f, old_password: e.target.value }))} />
          </div>
          <div style={S.row}>
            <div className="field">
              <label htmlFor="pw-new">New password</label>
              <input id="pw-new" type="password" value={pwForm.new_password} required minLength={8}
                onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" type="password" value={pwForm.confirm} required
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={pwSaving}>
            {pwSaving ? "Changing…" : "Change password"}
          </button>
        </form>
      </div>

      {/* ── My places ── */}
      <div style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ ...S.sectionTitle, margin: 0 }}>📍 My Submitted Places</h3>
          <Link to="/places/new"><button className="btn-primary" style={{ fontSize: "0.85rem", padding: "0.4em 0.9em" }}>+ Add place</button></Link>
        </div>
        {placesLoading ? (
          <p className="muted">Loading…</p>
        ) : myPlaces.length === 0 ? (
          <p className="muted">You haven't submitted any places yet.</p>
        ) : (
          myPlaces.map((p) => (
            <div key={p.id} style={S.placeCard}>
              <div>
                <Link to={`/places/${p.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>{p.name}</Link>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{p.category_name} · {p.city}</p>
              </div>
              <ConfidenceBadge score={p.overall_accessibility_score} />
            </div>
          ))
        )}
      </div>

      {/* ── My attribute submissions ── */}
      <div style={S.section}>
        <h3 style={S.sectionTitle}>✏ My Attribute Submissions</h3>
        {attrsLoading ? (
          <p className="muted">Loading…</p>
        ) : myAttrs.length === 0 ? (
          <p className="muted">No attribute submissions yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Attribute</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Value</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Status</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {myAttrs.slice(0, 20).map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{a.attribute_name}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>
                    {a.value_boolean != null ? (a.value_boolean ? "Yes" : "No") : a.value_number ?? a.value_text ?? "—"}
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>
                    <span style={{
                      padding: "0.15em 0.5em", borderRadius: 999, fontSize: "0.8rem", fontWeight: 600,
                      background: a.verification_status === "verified" ? "var(--color-primary-light)"
                        : a.verification_status === "disputed" ? "var(--color-warn-light)"
                        : a.verification_status === "rejected" ? "var(--color-danger-light)"
                        : "#f0f0f0",
                      color: a.verification_status === "verified" ? "var(--color-primary-dark)"
                        : a.verification_status === "disputed" ? "var(--color-warn)"
                        : a.verification_status === "rejected" ? "var(--color-danger)"
                        : "#555",
                    }}>
                      {a.verification_status}
                    </span>
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem", color: "var(--color-text-muted)", fontSize: "0.82rem" }}>
                    {new Date(a.submitted_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
