import { useState } from "react";
import { PlacesAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function BookmarkButton({ placeId, initialSaved = false, size = "md", onToggle }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate("/login");
      return;
    }

    setBusy(true);
    try {
      if (saved) {
        await PlacesAPI.removeBookmark(placeId);
        setSaved(false);
        if (onToggle) onToggle(false);
      } else {
        await PlacesAPI.bookmark(placeId);
        setSaved(true);
        if (onToggle) onToggle(true);
      }
    } catch {
      alert("Could not update bookmark.");
    } finally {
      setBusy(false);
    }
  }

  const dimensions = size === "sm" ? 30 : size === "lg" ? 44 : 36;
  const iconSize = size === "sm" ? "0.95rem" : size === "lg" ? "1.3rem" : "1.1rem";

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title={saved ? "Remove from saved places" : "Save this place"}
      aria-label={saved ? "Remove from saved places" : "Save this place"}
      style={{
        width: dimensions,
        height: dimensions,
        borderRadius: "50%",
        border: "1px solid",
        borderColor: saved ? "var(--color-primary)" : "var(--color-border)",
        background: saved ? "var(--color-primary-light)" : "#ffffff",
        color: saved ? "var(--color-primary-dark)" : "var(--color-text-muted)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.15s ease",
        flexShrink: 0,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <span style={{ fontSize: iconSize, lineHeight: 1 }}>
        {saved ? "❤️" : "🤍"}
      </span>
    </button>
  );
}
