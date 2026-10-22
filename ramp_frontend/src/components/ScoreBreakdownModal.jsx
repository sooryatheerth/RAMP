import { useEffect, useState } from "react";
import { PlacesAPI } from "../api/client";
import ConfidenceBadge from "./ConfidenceBadge";

export default function ScoreBreakdownModal({ placeId, placeName, currentScore, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    PlacesAPI.score(placeId)
      .then((res) => {
        setData(res.data);
        setError(null);
      })
      .catch(() => {
        setError("Could not load score breakdown details.");
      })
      .finally(() => setLoading(false));
  }, [placeId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 620,
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
          padding: "1.75rem",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Accessibility Score Transparency
            </span>
            <h2 id="score-modal-title" style={{ margin: "0.2rem 0 0", fontSize: "1.35rem" }}>
              {placeName}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              lineHeight: 1,
              cursor: "pointer",
              color: "var(--color-text-muted)",
              padding: "0.2rem 0.5rem",
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "2.5rem 0", color: "var(--color-text-muted)" }}>
            <p>Calculating verified accessibility metrics…</p>
          </div>
        ) : error ? (
          <div style={{ padding: "1rem", background: "var(--color-danger-light)", color: "var(--color-danger)", borderRadius: 8 }}>
            {error}
          </div>
        ) : (
          <div>
            {/* Overall Summary Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1.2rem 1.4rem",
                borderRadius: 12,
                background: "linear-gradient(135deg, #f0fdf4, #e6f7f2)",
                border: "1.5px solid var(--color-primary)",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-primary-dark)" }}>
                  Composite Accessibility Score
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-primary-dark)", lineHeight: 1.2, marginTop: "0.1rem" }}>
                  {data.overall_accessibility_score.toFixed(1)} <span style={{ fontSize: "1rem", fontWeight: 500 }}>/ 100</span>
                </div>
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  Calculated from peer-verified physical attributes & amenities
                </span>
              </div>
              <ConfidenceBadge score={data.overall_accessibility_score} />
            </div>

            {/* Pillar Breakdown */}
            <h3 style={{ fontSize: "1.05rem", marginBottom: "0.85rem" }}>How this score is calculated</h3>
            <div style={{ display: "grid", gap: "0.9rem", marginBottom: "1.5rem" }}>
              {/* 1. Entrance */}
              <div style={{ padding: "0.9rem 1rem", border: "1px solid var(--color-border)", borderRadius: 10, background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>🚪</span>
                    <strong>Entrance Accessibility</strong>
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--color-primary-dark)", fontSize: "0.95rem" }}>
                    {data.entrance.score} / {data.entrance.max} pts
                  </span>
                </div>
                <div style={{ width: "100%", height: 6, background: "var(--color-border)", borderRadius: 999, overflow: "hidden", marginBottom: "0.4rem" }}>
                  <div style={{ width: `${(data.entrance.score / data.entrance.max) * 100}%`, height: "100%", background: "var(--color-primary)", borderRadius: 999 }} />
                </div>
                <p className="muted" style={{ margin: 0, fontSize: "0.84rem" }}>
                  {data.entrance.description}
                  {data.entrance.total > 0 && ` (${data.entrance.accessible} accessible of ${data.entrance.total} recorded)`}
                </p>
              </div>

              {/* 2. Structured Attributes */}
              <div style={{ padding: "0.9rem 1rem", border: "1px solid var(--color-border)", borderRadius: 10, background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>📐</span>
                    <strong>Attribute Verification & Accuracy</strong>
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--color-primary-dark)", fontSize: "0.95rem" }}>
                    {data.attributes.score} / {data.attributes.max} pts
                  </span>
                </div>
                <div style={{ width: "100%", height: 6, background: "var(--color-border)", borderRadius: 999, overflow: "hidden", marginBottom: "0.4rem" }}>
                  <div style={{ width: `${(data.attributes.score / data.attributes.max) * 100}%`, height: "100%", background: "#0ea5e9", borderRadius: 999 }} />
                </div>
                <p className="muted" style={{ margin: 0, fontSize: "0.84rem" }}>
                  {data.attributes.description}
                  {data.attributes.total > 0 && (
                    <span>
                      {" "}· <span style={{ color: "var(--color-primary-dark)", fontWeight: 600 }}>{data.attributes.verified} verified</span>
                      {data.attributes.pending > 0 && <span>, {data.attributes.pending} pending</span>}
                      {data.attributes.disputed > 0 && <span style={{ color: "var(--color-danger)" }}>, {data.attributes.disputed} disputed</span>}
                    </span>
                  )}
                </p>
              </div>

              {/* 3. Facilities */}
              <div style={{ padding: "0.9rem 1rem", border: "1px solid var(--color-border)", borderRadius: 10, background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>🚻</span>
                    <strong>Interior Amenities & Facilities</strong>
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--color-primary-dark)", fontSize: "0.95rem" }}>
                    {data.facilities.score} / {data.facilities.max} pts
                  </span>
                </div>
                <div style={{ width: "100%", height: 6, background: "var(--color-border)", borderRadius: 999, overflow: "hidden", marginBottom: "0.4rem" }}>
                  <div style={{ width: `${(data.facilities.score / data.facilities.max) * 100}%`, height: "100%", background: "#f59e0b", borderRadius: 999 }} />
                </div>
                <p className="muted" style={{ margin: 0, fontSize: "0.84rem" }}>
                  {data.facilities.description}
                  {data.facilities.accessible_types?.length > 0 && (
                    <span> ({data.facilities.accessible_types.join(", ")})</span>
                  )}
                </p>
              </div>
            </div>

            {/* Recommendations Roadmap */}
            {data.recommendations?.length > 0 && (
              <div style={{ padding: "1rem", borderRadius: 10, background: "#f8fafc", border: "1px solid var(--color-border)" }}>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", color: "var(--color-text)" }}>
                  💡 How the community can improve this score:
                </h4>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                  {data.recommendations.map((rec, i) => (
                    <li key={i} style={{ marginBottom: "0.25rem" }}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: "1.5rem", textAlign: "right" }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
