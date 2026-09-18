import { useEffect, useState } from "react";
import { AdminPlacesAPI } from "../../api/adminClient";

export default function PlacesPanel() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editScore, setEditScore] = useState(null); // { id, score }
  const [savingScore, setSavingScore] = useState(false);

  async function load(pg = 1) {
    setLoading(true);
    try {
      const params = { page: pg };
      if (search) params.q = search;
      const { data } = await AdminPlacesAPI.list(params);
      const results = data.results ?? data;
      setPlaces(Array.isArray(results) ? results : []);
      if (data.count) setTotalPages(Math.ceil(data.count / 20));
    } catch {
      setPlaces([]);
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

  async function handleDeletePlace(id) {
    if (!window.confirm("Delete this place? This cannot be undone.")) return;
    try {
      await AdminPlacesAPI.delete(id);
      setPlaces((ps) => ps.filter((p) => p.id !== id));
    } catch { /* ignore */ }
  }

  async function saveScore() {
    if (!editScore) return;
    setSavingScore(true);
    try {
      const { data } = await AdminPlacesAPI.update(editScore.id, {
        overall_accessibility_score: editScore.score,
      });
      setPlaces((ps) => ps.map((p) => (p.id === data.id ? data : p)));
      setEditScore(null);
    } catch { /* ignore */ } finally { setSavingScore(false); }
  }

  return (
    <section>
      <h2 style={{ marginBottom: "1rem" }}>Places</h2>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.75rem", marginBottom: "1.2rem" }}>
        <input
          id="place-search"
          placeholder="Search name or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 220px" }}
          aria-label="Search places"
        />
        <button className="btn-primary" type="submit">Search</button>
      </form>

      {loading ? (
        <p className="muted">Loading places…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "var(--color-bg)" }}>
                {["Name", "Category", "City", "Score", "Added by", "Created", "Actions"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {places.length === 0 && (
                <tr><td colSpan={7} style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-muted)" }}>No places found.</td></tr>
              )}
              {places.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={tdStyle}><strong>{p.name}</strong></td>
                  <td style={tdStyle}>{p.category_name}</td>
                  <td style={tdStyle}>{p.city || "—"}</td>
                  <td style={tdStyle}>
                    {editScore?.id === p.id ? (
                      <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={editScore.score}
                          onChange={(e) => setEditScore({ ...editScore, score: e.target.value })}
                          style={{ width: 70, padding: "0.25em 0.4em" }}
                        />
                        <button className="btn-primary" style={{ padding: "0.25em 0.6em", fontSize: "0.82rem" }} onClick={saveScore} disabled={savingScore}>✓</button>
                        <button className="btn-secondary" style={{ padding: "0.25em 0.6em", fontSize: "0.82rem" }} onClick={() => setEditScore(null)}>✗</button>
                      </span>
                    ) : (
                      <span
                        style={{ cursor: "pointer", textDecoration: "underline dotted" }}
                        title="Click to edit score"
                        onClick={() => setEditScore({ id: p.id, score: p.overall_accessibility_score })}
                      >
                        {Number(p.overall_accessibility_score).toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>{p.added_by_username || "—"}</td>
                  <td style={tdStyle}>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <button
                      className="btn-link"
                      style={{ color: "var(--color-danger)" }}
                      onClick={() => handleDeletePlace(p.id)}
                    >
                      Delete
                    </button>
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
    </section>
  );
}

const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" };
const thStyle = { padding: "0.6rem 0.8rem", textAlign: "left", fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", color: "var(--color-text-muted)", borderBottom: "2px solid var(--color-border)" };
const tdStyle = { padding: "0.65rem 0.8rem" };
