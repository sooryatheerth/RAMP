import { useEffect, useState } from "react";
import { AdminPlaceCategoriesAPI } from "../../api/adminClient";

export default function PlaceCategoriesPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editItem, setEditItem] = useState(null); // { id, name }
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await AdminPlaceCategoriesAPI.list();
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
      const { data } = await AdminPlaceCategoriesAPI.create({ name: newName.trim() });
      setItems((it) => [...it, data]);
      setNewName("");
    } catch {
      setError("Failed to create. Name may already exist.");
    } finally { setSaving(false); }
  }

  async function handleUpdate(id, name) {
    setSaving(true);
    setError("");
    try {
      const { data } = await AdminPlaceCategoriesAPI.update(id, { name });
      setItems((it) => it.map((i) => (i.id === id ? data : i)));
      setEditItem(null);
    } catch {
      setError("Failed to update.");
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this category? Places using it may be affected.")) return;
    try {
      await AdminPlaceCategoriesAPI.delete(id);
      setItems((it) => it.filter((i) => i.id !== id));
    } catch { setError("Cannot delete – may have places attached."); }
  }

  return (
    <section>
      <h2 style={{ marginBottom: "1rem" }}>Place Categories</h2>

      <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <input
          id="new-category-name"
          placeholder="New category name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ flex: 1 }}
          aria-label="New category name"
        />
        <button className="btn-primary" type="submit" disabled={saving || !newName.trim()}>
          + Add
        </button>
      </form>
      {error && <p className="error-text" style={{ marginBottom: "0.75rem" }}>{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {items.length === 0 && <p className="muted">No categories yet.</p>}
          {items.map((item) => (
            <div key={item.id} className="card" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {editItem?.id === item.id ? (
                <>
                  <input
                    value={editItem.name}
                    onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                    style={{ flex: 1 }}
                    aria-label="Edit category name"
                  />
                  <button className="btn-primary" style={{ padding: "0.35em 0.8em" }} onClick={() => handleUpdate(item.id, editItem.name)} disabled={saving}>Save</button>
                  <button className="btn-secondary" style={{ padding: "0.35em 0.8em" }} onClick={() => setEditItem(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 600 }}>{item.name}</span>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>{item.place_count} place{item.place_count !== 1 ? "s" : ""}</span>
                  <button className="btn-link" onClick={() => setEditItem({ id: item.id, name: item.name })}>Edit</button>
                  <button className="btn-link" style={{ color: "var(--color-danger)" }} onClick={() => handleDelete(item.id)}>Delete</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
