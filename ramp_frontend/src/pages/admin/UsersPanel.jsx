import { useEffect, useState } from "react";
import { AdminUsersAPI } from "../../api/adminClient";

const USER_TYPES = ["individual", "venue_owner", "admin", "moderator"];

function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    user_type: user.user_type,
    is_active: user.is_active,
    is_staff: user.is_staff,
    reputation_score: user.reputation_score,
    is_verified_email: user.is_verified_email,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const { data } = await AdminUsersAPI.update(user.id, form);
      onSaved(data);
    } catch {
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ marginBottom: "1.2rem" }}>Edit User: {user.username}</h2>

        <div className="field">
          <label htmlFor="edit-user-type">User Type</label>
          <select
            id="edit-user-type"
            value={form.user_type}
            onChange={(e) => setForm({ ...form, user_type: e.target.value })}
          >
            {USER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="edit-reputation">Reputation Score</label>
          <input
            id="edit-reputation"
            type="number"
            value={form.reputation_score}
            onChange={(e) => setForm({ ...form, reputation_score: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} style={{ width: "auto" }} />
            Active
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
            <input type="checkbox" checked={form.is_staff} onChange={(e) => setForm({ ...form, is_staff: e.target.checked })} style={{ width: "auto" }} />
            Staff (admin access)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 500 }}>
            <input type="checkbox" checked={form.is_verified_email} onChange={(e) => setForm({ ...form, is_verified_email: e.target.checked })} style={{ width: "auto" }} />
            Email verified
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function load(pg = 1) {
    setLoading(true);
    try {
      const params = { page: pg };
      if (search) params.q = search;
      if (filterType) params.user_type = filterType;
      const { data } = await AdminUsersAPI.list(params);
      const results = data.results ?? data;
      setUsers(Array.isArray(results) ? results : []);
      if (data.count) setTotalPages(Math.ceil(data.count / 20));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page); }, [page]);

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    load(1);
  }

  async function handleDelete(id) {
    try {
      await AdminUsersAPI.delete(id);
      setUsers((u) => u.filter((x) => x.id !== id));
    } catch { /* ignore */ }
    setConfirmDelete(null);
  }

  function handleSaved(updated) {
    setUsers((us) => us.map((u) => (u.id === updated.id ? updated : u)));
    setEditing(null);
  }

  return (
    <section>
      <h2 style={{ marginBottom: "1rem" }}>Users</h2>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.75rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
        <input
          id="user-search"
          placeholder="Search username or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 220px", minWidth: 0 }}
          aria-label="Search users"
        />
        <select
          id="user-type-filter"
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); load(1); }}
          style={{ width: "auto" }}
          aria-label="Filter by user type"
        >
          <option value="">All types</option>
          {USER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn-primary" type="submit">Search</button>
      </form>

      {loading ? (
        <p className="muted">Loading users…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "var(--color-bg)" }}>
                {["Username", "Email", "Type", "Rep.", "Active", "Staff", "Joined", "Actions"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={8} style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-muted)" }}>No users found.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={tdStyle}><strong>{u.username}</strong></td>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}><span className={`confidence-badge ${u.user_type === "admin" || u.user_type === "moderator" ? "high" : "medium"}`}>{u.user_type}</span></td>
                  <td style={tdStyle}>{u.reputation_score}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{u.is_active ? "✓" : "✗"}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{u.is_staff ? "✓" : ""}</td>
                  <td style={tdStyle}>{new Date(u.date_joined).toLocaleDateString()}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <button className="btn-link" style={{ marginRight: "0.5rem" }} onClick={() => setEditing(u)}>Edit</button>
                    <button className="btn-link" style={{ color: "var(--color-danger)" }} onClick={() => setConfirmDelete(u)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1rem" }}>
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={{ lineHeight: "2.2rem", color: "var(--color-text-muted)" }}>Page {page} / {totalPages}</span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}

      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}

      {confirmDelete && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 380 }}>
            <h3>Delete user "{confirmDelete.username}"?</h3>
            <p className="muted">This action cannot be undone.</p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: "var(--color-danger)" }} onClick={() => handleDelete(confirmDelete.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const overlay = {
  position: "fixed", inset: 0, background: "rgba(38,38,34,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const modal = {
  background: "var(--color-surface)", borderRadius: "var(--radius)", padding: "2rem",
  maxWidth: 520, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
};
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" };
const thStyle = { padding: "0.6rem 0.8rem", textAlign: "left", fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", color: "var(--color-text-muted)", borderBottom: "2px solid var(--color-border)" };
const tdStyle = { padding: "0.65rem 0.8rem" };
