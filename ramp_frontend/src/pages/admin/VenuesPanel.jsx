import { useEffect, useState } from "react";
import { AdminVenuesAPI } from "../../api/adminClient";

const STATUS_BADGE = {
  pending: { cls: "medium", label: "Pending" },
  approved: { cls: "high", label: "Approved" },
  rejected: { cls: "low", label: "Rejected" },
};

export default function VenuesPanel() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(null); // id of venue being actioned

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.approval_status = filter;
      const { data } = await AdminVenuesAPI.list(params);
      setVenues(data.results ?? data);
    } catch {
      setVenues([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function handleApprove(id) {
    setBusy(id);
    try {
      const { data } = await AdminVenuesAPI.approve(id);
      setVenues((vs) => vs.map((v) => (v.id === id ? data : v)));
    } catch { /* ignore */ } finally { setBusy(null); }
  }

  async function handleReject(id) {
    setBusy(id);
    try {
      const { data } = await AdminVenuesAPI.reject(id);
      setVenues((vs) => vs.map((v) => (v.id === id ? data : v)));
    } catch { /* ignore */ } finally { setBusy(null); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this venue owner profile?")) return;
    try {
      await AdminVenuesAPI.delete(id);
      setVenues((vs) => vs.filter((v) => v.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <section>
      <h2 style={{ marginBottom: "1rem" }}>Venue Owner Profiles</h2>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.2rem" }}>
        {["", "pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={filter === s ? "btn-primary" : "btn-secondary"}
            style={{ padding: "0.4em 1em" }}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading venues…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {venues.length === 0 && <p className="muted">No venue profiles found.</p>}
          {venues.map((v) => {
            const badge = STATUS_BADGE[v.approval_status] || STATUS_BADGE.pending;
            return (
              <div key={v.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
                    <strong style={{ fontSize: "1.05rem" }}>{v.business_name}</strong>
                    <span className={`confidence-badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                    Owner: {v.username} ({v.email})
                    {v.reviewed_at && (
                      <> · Reviewed {new Date(v.reviewed_at).toLocaleDateString()}</>
                    )}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {v.approval_status !== "approved" && (
                    <button
                      className="btn-primary"
                      style={{ padding: "0.4em 0.9em", fontSize: "0.85rem" }}
                      disabled={busy === v.id}
                      onClick={() => handleApprove(v.id)}
                    >
                      Approve
                    </button>
                  )}
                  {v.approval_status !== "rejected" && (
                    <button
                      className="btn-secondary"
                      style={{ padding: "0.4em 0.9em", fontSize: "0.85rem", color: "var(--color-warn)", borderColor: "var(--color-warn)" }}
                      disabled={busy === v.id}
                      onClick={() => handleReject(v.id)}
                    >
                      Reject
                    </button>
                  )}
                  <button
                    className="btn-link"
                    style={{ color: "var(--color-danger)", fontSize: "0.85rem" }}
                    onClick={() => handleDelete(v.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
