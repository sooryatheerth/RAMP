import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function AccessPointsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    // Fetch all access points via the nested places route (admin proxy)
    // We read all places first, then fetch their access points in batch.
    // For admin, we use the places endpoint with a large page size.
    api.get("/admin/places/?page_size=200")
      .then(async (res) => {
        const places = res.data.results || res.data;
        const allAPs = [];
        await Promise.all(
          places.slice(0, 50).map(async (place) => {
            try {
              const r = await api.get(`/places/${place.id}/access-points/`);
              const aps = r.data.results || r.data;
              aps.forEach((ap) => allAPs.push({ ...ap, place_name: place.name, place_id: place.id }));
            } catch {}
          })
        );
        allAPs.sort((a, b) => b.id - a.id);
        setItems(allAPs);
      })
      .finally(() => setLoading(false));
  }, []);

  function startEdit(ap) {
    setEditId(ap.id);
    setEditForm({ label: ap.label, notes: ap.notes, is_accessible: ap.is_accessible, is_primary_accessible_entrance: ap.is_primary_accessible_entrance });
    setError("");
  }

  async function saveEdit(ap) {
    setSaving(true); setError("");
    try {
      await api.patch(`/places/${ap.place_id}/access-points/${ap.id}/`, editForm);
      setItems((prev) => prev.map((x) => x.id === ap.id ? { ...x, ...editForm } : x));
      setEditId(null);
    } catch (e) {
      setError(e.response?.data?.detail || "Save failed.");
    } finally { setSaving(false); }
  }

  const filtered = items.filter((ap) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return ap.label?.toLowerCase().includes(s) || ap.place_name?.toLowerCase().includes(s);
  });

  const btnStyle = { padding: "0.3em 0.65em", fontSize: "0.82rem", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>Access Points</h2>
        <span className="muted" style={{ fontSize: "0.9rem" }}>{items.length} total (first 50 places)</span>
      </div>

      <div className="field" style={{ marginBottom: "1rem" }}>
        <label htmlFor="ap-search">Search by label or place name</label>
        <input id="ap-search" type="search" placeholder="Main Entrance…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <p className="muted">Loading access points…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">No access points found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
              <th style={{ padding: "0.5rem 0.6rem" }}>Label</th>
              <th style={{ padding: "0.5rem 0.6rem" }}>Place</th>
              <th style={{ padding: "0.5rem 0.6rem" }}>Accessible</th>
              <th style={{ padding: "0.5rem 0.6rem" }}>Primary entrance</th>
              <th style={{ padding: "0.5rem 0.6rem" }}>Notes</th>
              <th style={{ padding: "0.5rem 0.6rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ap) => (
              <tr key={ap.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                {editId === ap.id ? (
                  <>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      <input value={editForm.label} onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))} style={{ width: 130 }} />
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      <Link to={`/places/${ap.place_id}`} style={{ fontSize: "0.85rem" }}>{ap.place_name}</Link>
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      <input type="checkbox" checked={editForm.is_accessible} onChange={(e) => setEditForm((f) => ({ ...f, is_accessible: e.target.checked }))} />
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      <input type="checkbox" checked={editForm.is_primary_accessible_entrance} onChange={(e) => setEditForm((f) => ({ ...f, is_primary_accessible_entrance: e.target.checked }))} />
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }} colSpan={1}>
                      <input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} style={{ width: "100%" }} />
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button style={{ ...btnStyle, background: "var(--color-primary)", color: "#fff" }} onClick={() => saveEdit(ap)} disabled={saving}>{saving ? "…" : "Save"}</button>
                        <button style={{ ...btnStyle, background: "#f0f0f0", color: "#333" }} onClick={() => setEditId(null)}>✕</button>
                      </div>
                      {error && <p className="error-text" style={{ marginTop: "0.25rem" }}>{error}</p>}
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "0.45rem 0.6rem", fontWeight: 600 }}>{ap.label}</td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      <Link to={`/places/${ap.place_id}`} style={{ fontSize: "0.85rem", textDecoration: "none", color: "var(--color-primary-dark)" }}>{ap.place_name}</Link>
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      <span style={{ color: ap.is_accessible ? "var(--color-primary)" : "var(--color-danger)", fontWeight: 600 }}>
                        {ap.is_accessible ? "✓ Yes" : "✗ No"}
                      </span>
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      {ap.is_primary_accessible_entrance ? <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>★ Primary</span> : <span className="muted">—</span>}
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem", color: "var(--color-text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ap.notes || "—"}
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      <button style={{ ...btnStyle, background: "#eef2ff", color: "#3730a3" }} onClick={() => startEdit(ap)}>Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
