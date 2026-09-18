import { useEffect, useState } from "react";
import { AdminFacilityTypesAPI } from "../../api/adminClient";

export default function FacilityTypesPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editItem, setEditItem] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await AdminFacilityTypesAPI.list();
      setItems(data.results ?? data);
    } catch { setItems([]); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await AdminFacilityTypesAPI.create({ name: newName.trim() });
      setItems((it) => [...it, data]);
      setNewName("");
    } catch { setError("Failed to create. Name may already exist."); }
    finally { setSaving(false); }
  }

  async function handleUpdate(id, name) {
    setSaving(true);
    setError("");
    try {
      const { data } = await AdminFacilityTypesAPI.update(id, { name });
      setItems((it) => it.map((i) => (i.id === id ? data : i)));
      setEditItem(null);
    } catch { setError("Failed to update."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this facility type?")) return;
    try {
      await AdminFacilityTypesAPI.delete(id);
      setItems((it) => it.filter((i) => i.id !== id));
    } catch { setError("Cannot delete – may be in use."); }
  }

  return (
    <section>
      <h2 style={{ marginBottom: "1rem" }}>Facility Types</h2>

      <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <input
          id="new-facility-type"
          placeholder="New facility type (e.g. Elevator)…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ flex: 1 }}
          aria-label="New facility type name"
        />
        <button className="btn-primary" type="submit" disabled={saving || !newName.trim()}>+ Add</button>
      </form>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.6rem" }}>
          {items.length === 0 && <p className="muted">No facility types yet.</p>}
          {items.map((item) => (
            <div key={item.id} className="card" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {editItem?.id === item.id ? (
                <>
                  <input
                    value={editItem.name}
                    onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                    style={{ flex: 1 }}
                    aria-label="Edit facility type name"
                  />
                  <button className="btn-primary" style={{ padding: "0.3em 0.6em", fontSize: "0.82rem" }} onClick={() => handleUpdate(item.id, editItem.name)} disabled={saving}>✓</button>
                  <button className="btn-secondary" style={{ padding: "0.3em 0.6em", fontSize: "0.82rem" }} onClick={() => setEditItem(null)}>✗</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "0.9rem" }}>{item.name}</span>
                  <button className="btn-link" style={{ padding: "0.2em" }} onClick={() => setEditItem({ id: item.id, name: item.name })}>✎</button>
                  <button className="btn-link" style={{ color: "var(--color-danger)", padding: "0.2em" }} onClick={() => handleDelete(item.id)}>✕</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
