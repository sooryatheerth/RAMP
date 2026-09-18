import { useEffect, useState } from "react";
import { AdminAttributeDefinitionsAPI, AdminAttributeVerificationsAPI } from "../../api/adminClient";

const APPLIES_TO = ["access_point", "facility", "both"];
const DATA_TYPES = ["boolean", "number", "text", "choice"];

function AttributeDefForm({ initial, onSave, onCancel }) {
  const blank = { name: "", applies_to: "both", data_type: "boolean", unit: "", is_required: false, facility_type: null, choice_options: null };
  const [form, setForm] = useState(initial ?? blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch { setError("Failed to save."); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div className="field">
          <label htmlFor="adef-name">Name</label>
          <input id="adef-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="field">
          <label htmlFor="adef-applies">Applies to</label>
          <select id="adef-applies" value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value })}>
            {APPLIES_TO.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="adef-dtype">Data type</label>
          <select id="adef-dtype" value={form.data_type} onChange={(e) => setForm({ ...form, data_type: e.target.value })}>
            {DATA_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="adef-unit">Unit (optional)</label>
          <input id="adef-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="cm, degrees…" />
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", fontWeight: 500 }}>
        <input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} style={{ width: "auto" }} />
        Required attribute
      </label>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : (initial ? "Save changes" : "Create")}</button>
        <button className="btn-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function AttributesPanel() {
  const [defs, setDefs] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [tab, setTab] = useState("definitions");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);

  async function loadDefs() {
    setLoading(true);
    try {
      const { data } = await AdminAttributeDefinitionsAPI.list();
      setDefs(data.results ?? data);
    } catch { setDefs([]); } finally { setLoading(false); }
  }

  async function loadVerifications() {
    setLoading(true);
    try {
      const { data } = await AdminAttributeVerificationsAPI.list();
      setVerifications(data.results ?? data);
    } catch { setVerifications([]); } finally { setLoading(false); }
  }

  useEffect(() => {
    if (tab === "definitions") loadDefs();
    else loadVerifications();
  }, [tab]);

  async function handleCreate(form) {
    const { data } = await AdminAttributeDefinitionsAPI.create(form);
    setDefs((ds) => [...ds, data]);
    setShowCreate(false);
  }

  async function handleUpdate(id, form) {
    const { data } = await AdminAttributeDefinitionsAPI.update(id, form);
    setDefs((ds) => ds.map((d) => (d.id === id ? data : d)));
    setEditItem(null);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this attribute definition?")) return;
    try {
      await AdminAttributeDefinitionsAPI.delete(id);
      setDefs((ds) => ds.filter((d) => d.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <section>
      <h2 style={{ marginBottom: "1rem" }}>Accessibility Attributes</h2>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.2rem" }}>
        {["definitions", "verifications"].map((t) => (
          <button key={t} className={tab === t ? "btn-primary" : "btn-secondary"} style={{ padding: "0.4em 1em" }} onClick={() => setTab(t)}>
            {t === "definitions" ? "Attribute Definitions" : "Verification Log"}
          </button>
        ))}
      </div>

      {tab === "definitions" && (
        <>
          {!showCreate && !editItem && (
            <button className="btn-primary" style={{ marginBottom: "1rem" }} onClick={() => setShowCreate(true)}>
              + New Attribute Definition
            </button>
          )}
          {showCreate && <AttributeDefForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />}

          {loading ? <p className="muted">Loading…</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {defs.length === 0 && <p className="muted">No attribute definitions yet.</p>}
              {defs.map((def) => (
                <div key={def.id}>
                  {editItem?.id === def.id ? (
                    <AttributeDefForm
                      initial={editItem}
                      onSave={(form) => handleUpdate(def.id, form)}
                      onCancel={() => setEditItem(null)}
                    />
                  ) : (
                    <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <div>
                        <strong>{def.name}</strong>
                        <span className="muted" style={{ marginLeft: "0.75rem", fontSize: "0.85rem" }}>
                          {def.data_type} · {def.applies_to} {def.unit ? `· ${def.unit}` : ""} {def.is_required ? "· required" : ""}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="btn-link" onClick={() => setEditItem({ ...def })}>Edit</button>
                        <button className="btn-link" style={{ color: "var(--color-danger)" }} onClick={() => handleDelete(def.id)}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "verifications" && (
        <>
          {loading ? <p className="muted">Loading…</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "var(--color-bg)" }}>
                    {["Table", "Attribute ID", "By", "Action", "Comment", "Date"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {verifications.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-muted)" }}>No verifications yet.</td></tr>
                  )}
                  {verifications.map((v) => (
                    <tr key={v.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={tdStyle}>{v.attribute_table}</td>
                      <td style={tdStyle}>{v.attribute_row_id}</td>
                      <td style={tdStyle}>{v.verified_by_username}</td>
                      <td style={tdStyle}>
                        <span className={`confidence-badge ${v.action === "confirm" ? "high" : v.action === "dispute" ? "medium" : "low"}`}>
                          {v.action}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.comment || "—"}</td>
                      <td style={tdStyle}>{new Date(v.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" };
const thStyle = { padding: "0.6rem 0.8rem", textAlign: "left", fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", color: "var(--color-text-muted)", borderBottom: "2px solid var(--color-border)" };
const tdStyle = { padding: "0.65rem 0.8rem" };
