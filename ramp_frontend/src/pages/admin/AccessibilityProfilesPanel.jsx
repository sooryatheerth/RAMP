import { useEffect, useState } from "react";
import { AdminAccessibilityProfilesAPI } from "../../api/adminClient";

export default function AccessibilityProfilesPanel() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ code: "", label: "" });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    AdminAccessibilityProfilesAPI.list()
      .then((r) => setProfiles(r.data.results || r.data))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }

  function startEdit(p) {
    setEditId(p.id);
    setForm({ code: p.code, label: p.label });
    setCreating(false);
    setError("");
  }

  function startCreate() {
    setCreating(true);
    setEditId(null);
    setForm({ code: "", label: "" });
    setError("");
  }

  async function save() {
    if (!form.code.trim() || !form.label.trim()) { setError("Code and label are required."); return; }
    setSaving(true); setError("");
    try {
      if (creating) {
        await AdminAccessibilityProfilesAPI.create(form);
      } else {
        await AdminAccessibilityProfilesAPI.update(editId, form);
      }
      setCreating(false); setEditId(null);
      load();
    } catch (e) {
      const data = e.response?.data;
      setError(typeof data === "object" ? JSON.stringify(data) : "Save failed.");
    } finally { setSaving(false); }
  }

  async function deleteProfile(id) {
    if (!window.confirm("Delete this accessibility profile?")) return;
    try {
      await AdminAccessibilityProfilesAPI.delete(id);
      load();
    } catch { /* ignore */ }
  }

  const btnStyle = { padding: "0.35em 0.7em", fontSize: "0.82rem", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ margin: 0 }}>Accessibility Profiles</h2>
        <button className="btn-primary" onClick={startCreate} style={{ fontSize: "0.9rem" }}>+ New profile</button>
      </div>

      <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
        Profiles describe the accessibility needs of users (e.g. wheelchair, visual, hearing). Users can select multiple profiles on their account.
      </p>

      {(creating || editId) && (
        <div className="card" style={{ marginBottom: "1.25rem", padding: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>{creating ? "New Profile" : "Edit Profile"}</h3>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem", marginBottom: "1rem" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="prof-code">Slug code</label>
              <input id="prof-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} placeholder="e.g. wheelchair" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="prof-label">Display label</label>
              <input id="prof-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Wheelchair user" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            <button className="btn-secondary" onClick={() => { setCreating(false); setEditId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : profiles.length === 0 ? (
        <p className="muted">No profiles yet. Add one above.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
              <th style={{ padding: "0.5rem 0.75rem" }}>Code</th>
              <th style={{ padding: "0.5rem 0.75rem" }}>Label</th>
              <th style={{ padding: "0.5rem 0.75rem", width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "0.55rem 0.75rem" }}>
                  <code style={{ background: "var(--color-primary-light)", padding: "0.15em 0.5em", borderRadius: 4, fontSize: "0.85rem" }}>{p.code}</code>
                </td>
                <td style={{ padding: "0.55rem 0.75rem" }}>{p.label}</td>
                <td style={{ padding: "0.55rem 0.75rem", display: "flex", gap: "0.4rem" }}>
                  <button style={{ ...btnStyle, background: "#eef2ff", color: "#3730a3" }} onClick={() => startEdit(p)}>Edit</button>
                  <button style={{ ...btnStyle, background: "var(--color-danger-light)", color: "var(--color-danger)" }} onClick={() => deleteProfile(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
