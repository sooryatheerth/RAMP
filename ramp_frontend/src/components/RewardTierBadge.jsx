import React from "react";

const TIER_STYLES = {
  bronze: {
    bg: "#fef3c7",
    color: "#92400e",
    border: "#fde68a",
    icon: "🥉",
    name: "Bronze Contributor",
    title: "Novice Scout",
  },
  silver: {
    bg: "#f1f5f9",
    color: "#334155",
    border: "#cbd5e1",
    icon: "🥈",
    name: "Silver Contributor",
    title: "Trusted Pathfinder",
  },
  gold: {
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fcd34d",
    icon: "🥇",
    name: "Gold Contributor",
    title: "Accessibility Champion",
  },
  platinum: {
    bg: "#f0f9ff",
    color: "#0369a1",
    border: "#7dd3fc",
    icon: "💎",
    name: "Platinum Contributor",
    title: "Master Cartographer",
  },
  diamond: {
    bg: "#f5f3ff",
    color: "#6d28d9",
    border: "#c4b5fd",
    icon: "👑",
    name: "Diamond Contributor",
    title: "Accessibility Legend",
  },
};

export default function RewardTierBadge({
  tier = "bronze",
  title = null,
  showTitle = true,
  size = "md",
  className = "",
  style = {},
}) {
  const normalizedTier = (tier || "bronze").toLowerCase();
  const info = TIER_STYLES[normalizedTier] || TIER_STYLES.bronze;
  const displayTitle = title || info.title;

  const sizeStyles = {
    sm: {
      padding: "0.15rem 0.5rem",
      fontSize: "0.75rem",
      gap: "0.3rem",
    },
    md: {
      padding: "0.25rem 0.65rem",
      fontSize: "0.82rem",
      gap: "0.35rem",
    },
    lg: {
      padding: "0.4rem 0.9rem",
      fontSize: "0.95rem",
      gap: "0.5rem",
    },
  }[size] || sizeStyles.md;

  return (
    <span
      className={`reward-tier-badge ${className}`}
      title={`${info.name}: ${displayTitle}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: info.bg,
        color: info.color,
        border: `1px solid ${info.border}`,
        borderRadius: 999,
        fontWeight: 700,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        ...sizeStyles,
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: size === "lg" ? "1.1rem" : "0.95rem" }}>
        {info.icon}
      </span>
      {showTitle && <span>{displayTitle}</span>}
    </span>
  );
}
