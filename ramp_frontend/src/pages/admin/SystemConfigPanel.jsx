import { useEffect, useState } from "react";
import { AdminSystemConfigAPI } from "../../api/adminClient";

export default function SystemConfigPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null); // { id, config_key, config_value, description }
  const [newItem, setNewItem] = useState({ config_key: "", config_value: "", description: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data } = await AdminSystemConfigAPI.list();
      setItems(data.results ?? data);
    } catch { setItems([]); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleUpdate(id) {
    if (!editItem) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await AdminSystemConfigAPI.update(id, {
        config_value: editItem.config_value,
        description: editItem.description,
      });
      setItems((its) => its.map((i) => (i.id === id ? data : i)));
      setEditItem(null);
    } catch { setError("Failed to save."); }
    finally { setSaving(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newItem.config_key.trim() || !newItem.config_value.trim()) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await AdminSystemConfigAPI.create(newItem);
      setItems((its) => [...its, data]);
      setNewItem({ config_key: "", config_value: "", description: "" });
      setShowCreate(false);
    } catch { setError("Failed to create. Key may already exist."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this configuration key?")) return;
    try {
      await AdminSystemConfigAPI.delete(id);
      setItems((its) => its.filter((i) => i.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <section>
      <h2 style={{ marginBottom: "0.5rem" }}>System Configuration</h2>
      <p className="muted" style={{ marginBottom: "1.2rem", fontSize: "0.9rem" }}>
        These values override Django settings at runtime. Keys mirror the RAMP_CONFIG dictionary.
      </p>

      <button className="btn-primary" style={{ marginBottom: "1rem" }} onClick={() => setShowCreate((s) => !s)}>
        {showCreate ? "Cancel" : "+ New Config Key"}
      </button>

      {showCreate && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: "1.2rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="field">
              <label htmlFor="cfg-key">Config Key</label>
              <input id="cfg-key" value={newItem.config_key} onChange={(e) => setNewItem({ ...newItem, config_key: e.target.value })} placeholder="e.g. VERIFICATION_THRESHOLD" required />
            </div>
            <div className="field">
              <label htmlFor="cfg-val">Value</label>
              <input id="cfg-val" value={newItem.config_value} onChange={(e) => setNewItem({ ...newItem, config_value: e.target.value })} placeholder="e.g. 3" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="cfg-desc">Description</label>
            <input id="cfg-desc" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="What this setting controls…" />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Creating…" : "Create"}</button>
        </form>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {items.length === 0 && <p className="muted">No system config entries. Defaults from settings.py are in effect.</p>}
          {items.map((item) => (
            <div key={item.id} className="card">
              {editItem?.id === item.id ? (
                <div>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
                    <code style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--color-primary-dark)", fontSize: "0.95rem" }}>
                      {item.config_key}
                    </code>
                  </div>
                  <div className="field">
                    <label htmlFor={`cfg-edit-val-${item.id}`}>Value</label>
                    <input
                      id={`cfg-edit-val-${item.id}`}
                      value={editItem.config_value}
                      onChange={(e) => setEditItem({ ...editItem, config_value: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`cfg-edit-desc-${item.id}`}>Description</label>
                    <input
                      id={`cfg-edit-desc-${item.id}`}
                      value={editItem.description}
                      onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
                    />
                  </div>
                  {error && <p className="error-text">{error}</p>}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="btn-primary" onClick={() => handleUpdate(item.id)} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                    <button className="btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.25rem" }}>
                      <code style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--color-primary-dark)", fontSize: "0.95rem" }}>
                        {item.config_key}
                      </code>
                      <span style={{
                        background: "var(--color-primary-light)", color: "var(--color-primary-dark)",
                        borderRadius: 6, padding: "0.15em 0.6em", fontFamily: "monospace", fontSize: "0.9rem", fontWeight: 700,
                      }}>
                        {item.config_value}
                      </span>
                    </div>
                    {item.description && (
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{item.description}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="btn-link" onClick={() => setEditItem({ ...item })}>Edit</button>
                    <button className="btn-link" style={{ color: "var(--color-danger)" }} onClick={() => handleDelete(item.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
