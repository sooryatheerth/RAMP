import { useEffect, useState } from "react";
import { AdminImagesAPI } from "../../api/adminClient";

const STATUS_COLORS = {
  pending: { cls: "medium", label: "Pending" },
  verified: { cls: "high", label: "Verified" },
  flagged: { cls: "low", label: "Flagged" },
  removed: { cls: "low", label: "Removed" },
};

export default function ImagesPanel() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [busy, setBusy] = useState(null);
  const [flagReason, setFlagReason] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function load(pg = 1) {
    setLoading(true);
    try {
      const params = { page: pg };
      if (filter) params.verification_status = filter;
      const { data } = await AdminImagesAPI.list(params);
      const results = data.results ?? data;
      setImages(Array.isArray(results) ? results : []);
      if (data.count) setTotalPages(Math.ceil(data.count / 20));
    } catch { setImages([]); } finally { setLoading(false); }
  }

  useEffect(() => { setPage(1); load(1); }, [filter]);

  async function act(id, action, extra) {
    setBusy(id);
    try {
      let res;
      if (action === "verify") res = await AdminImagesAPI.verify(id);
      else if (action === "flag") res = await AdminImagesAPI.flag(id, extra?.reason || "");
      else if (action === "remove") res = await AdminImagesAPI.remove(id);
      if (res) {
        setImages((imgs) => imgs.map((img) => (img.id === id ? res.data : img)));
      }
    } catch { /* ignore */ } finally { setBusy(null); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Permanently delete this image record?")) return;
    try {
      await AdminImagesAPI.delete(id);
      setImages((imgs) => imgs.filter((img) => img.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <section>
      <h2 style={{ marginBottom: "1rem" }}>Image Moderation</h2>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
        {["", "pending", "verified", "flagged", "removed"].map((s) => (
          <button key={s} className={filter === s ? "btn-primary" : "btn-secondary"} style={{ padding: "0.4em 1em" }} onClick={() => setFilter(s)}>
            {s === "" ? "All" : STATUS_COLORS[s]?.label || s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading images…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {images.length === 0 && <p className="muted" style={{ gridColumn: "1/-1" }}>No images found.</p>}
          {images.map((img) => {
            const badge = STATUS_COLORS[img.verification_status] || STATUS_COLORS.pending;
            const thumbUrl = `/api/images/${img.id}/thumb/`;
            return (
              <div key={img.id} className="card" style={{ padding: "1rem" }}>
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <img
                    src={thumbUrl}
                    alt={img.alt_text || "Image thumbnail"}
                    style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, background: "var(--color-bg)", flexShrink: 0 }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                      <span className={`confidence-badge ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p style={{ margin: "0 0 0.2rem", fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                      {img.entity_type} #{img.entity_id}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                      By: {img.uploaded_by_username || "unknown"} · {(img.file_size_bytes / 1024).toFixed(0)} KB
                    </p>
                    {img.caption && <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem" }}>{img.caption}</p>}
                    {img.flagged_reason && (
                      <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "var(--color-warn)" }}>
                        Flag reason: {img.flagged_reason}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {img.verification_status !== "verified" && (
                      <button className="btn-primary" style={{ flex: 1, fontSize: "0.82rem", padding: "0.35em" }} disabled={busy === img.id} onClick={() => act(img.id, "verify")}>
                        ✓ Verify
                      </button>
                    )}
                    {img.verification_status !== "removed" && (
                      <button className="btn-secondary" style={{ flex: 1, fontSize: "0.82rem", padding: "0.35em", color: "var(--color-danger)", borderColor: "var(--color-danger)" }} disabled={busy === img.id} onClick={() => act(img.id, "remove")}>
                        Remove
                      </button>
                    )}
                    <button className="btn-secondary" style={{ flex: 1, fontSize: "0.82rem", padding: "0.35em", color: "var(--color-warn)", borderColor: "var(--color-warn)" }} disabled={busy === img.id} onClick={() => act(img.id, "flag", { reason: flagReason[img.id] || "" })}>
                      Flag
                    </button>
                  </div>
                  <input
                    placeholder="Flag reason (optional)"
                    value={flagReason[img.id] || ""}
                    onChange={(e) => setFlagReason((r) => ({ ...r, [img.id]: e.target.value }))}
                    style={{ fontSize: "0.82rem", padding: "0.3em 0.5em" }}
                    aria-label="Flag reason"
                  />
                  <button className="btn-link" style={{ color: "var(--color-danger)", fontSize: "0.8rem", textAlign: "left" }} onClick={() => handleDelete(img.id)}>
                    Delete record
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1.2rem" }}>
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={{ lineHeight: "2.2rem", color: "var(--color-text-muted)" }}>Page {page} / {totalPages}</span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </section>
  );
}
