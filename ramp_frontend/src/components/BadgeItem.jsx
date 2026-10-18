import React from "react";
import RewardTierBadge from "./RewardTierBadge";

const TIER_ACCENTS = {
  bronze: { border: "#fde68a", glow: "rgba(245, 158, 11, 0.12)", ribbon: "#b45309" },
  silver: { border: "#cbd5e1", glow: "rgba(148, 163, 184, 0.15)", ribbon: "#475569" },
  gold: { border: "#fcd34d", glow: "rgba(245, 158, 11, 0.22)", ribbon: "#d97706" },
  platinum: { border: "#7dd3fc", glow: "rgba(14, 165, 233, 0.22)", ribbon: "#0284c7" },
  diamond: { border: "#c4b5fd", glow: "rgba(139, 92, 246, 0.25)", ribbon: "#7c3aed" },
};

export default function BadgeItem({ badge, isUnlocked = false, awardedAt = null, progress = null }) {
  const tier = (badge.tier || "bronze").toLowerCase();
  const accent = TIER_ACCENTS[tier] || TIER_ACCENTS.bronze;

  const currentVal = progress?.current_value ?? (isUnlocked ? badge.threshold : 0);
  const targetVal = progress?.target_value ?? badge.threshold ?? 1;
  const progressPct = isUnlocked ? 100 : Math.min(100, Math.round(((currentVal || 0) / (targetVal || 1)) * 100));

  return (
    <div
      className="badge-item-card"
      style={{
        background: isUnlocked ? "var(--color-surface)" : "rgba(248, 250, 252, 0.75)",
        border: `1.5px solid ${isUnlocked ? accent.border : "var(--color-border)"}`,
        borderRadius: 14,
        padding: "1.1rem 1.2rem",
        boxShadow: isUnlocked ? `0 4px 14px ${accent.glow}, var(--shadow)` : "var(--shadow)",
        opacity: isUnlocked ? 1 : 0.88,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top tier ribbon line for unlocked cards */}
      {isUnlocked && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: accent.ribbon,
          }}
        />
      )}

      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                background: isUnlocked ? "var(--color-primary-light)" : "#e2e8f0",
                filter: isUnlocked ? "none" : "grayscale(0.85)",
                boxShadow: isUnlocked ? "0 2px 8px rgba(15, 110, 86, 0.15)" : "none",
              }}
            >
              {badge.icon || "🏆"}
            </span>
            <div>
              <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: isUnlocked ? "var(--color-text)" : "var(--color-text-muted)" }}>
                {badge.name}
              </h4>
              <span className="muted" style={{ fontSize: "0.78rem", textTransform: "capitalize" }}>
                {badge.category_label || badge.category}
              </span>
            </div>
          </div>

          <RewardTierBadge tier={badge.tier} size="sm" showTitle={false} />
        </div>

        <p style={{ fontSize: "0.86rem", color: isUnlocked ? "var(--color-text)" : "var(--color-text-muted)", margin: "0 0 0.85rem", lineHeight: 1.45 }}>
          {badge.description}
        </p>
      </div>

      <div>
        {/* Progress bar for locked or unlocked */}
        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.25rem" }}>
            <span className="muted">
              {isUnlocked ? "Achieved" : `${currentVal} / ${targetVal}`}
            </span>
            <span style={{ fontWeight: 600, color: isUnlocked ? "var(--color-primary-dark)" : "var(--color-text-muted)" }}>
              {progressPct}%
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: 6,
              background: "#e2e8f0",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                background: isUnlocked
                  ? "linear-gradient(90deg, var(--color-primary), #10b981)"
                  : "linear-gradient(90deg, #94a3b8, #64748b)",
                borderRadius: 999,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.78rem" }}>
          {badge.points_reward > 0 ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                color: "var(--color-primary-dark)",
                fontWeight: 700,
                background: "var(--color-primary-light)",
                padding: "0.15rem 0.5rem",
                borderRadius: 999,
              }}
            >
              ⭐ +{badge.points_reward} pts
            </span>
          ) : (
            <span />
          )}

          {isUnlocked && awardedAt && (
            <span className="muted" style={{ fontSize: "0.76rem" }}>
              Unlocked {new Date(awardedAt).toLocaleDateString()}
            </span>
          )}
          {!isUnlocked && (
            <span style={{ color: "var(--color-warn)", fontWeight: 600 }}>
              Locked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
