import { useState, useEffect, lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AdminAPI } from "../api/adminClient";

// Lazy-load panels so the heavy code is only fetched when needed
const UsersPanel = lazy(() => import("./admin/UsersPanel"));
const VenuesPanel = lazy(() => import("./admin/VenuesPanel"));
const PlacesPanel = lazy(() => import("./admin/PlacesPanel"));
const PlaceCategoriesPanel = lazy(() => import("./admin/PlaceCategoriesPanel"));
const FacilityTypesPanel = lazy(() => import("./admin/FacilityTypesPanel"));
const AttributesPanel = lazy(() => import("./admin/AttributesPanel"));
const ImagesPanel = lazy(() => import("./admin/ImagesPanel"));
const SystemConfigPanel = lazy(() => import("./admin/SystemConfigPanel"));

const NAV_SECTIONS = [
  { key: "overview",     icon: "📊", label: "Overview" },
  { key: "users",        icon: "👤", label: "Users" },
  { key: "venues",       icon: "🏢", label: "Venue Owners" },
  { key: "places",       icon: "📍", label: "Places" },
  { key: "categories",   icon: "🏷️", label: "Place Categories" },
  { key: "facility-types", icon: "🔑", label: "Facility Types" },
  { key: "attributes",   icon: "📋", label: "Attributes" },
  { key: "images",       icon: "🖼️", label: "Images" },
  { key: "config",       icon: "⚙️", label: "System Config" },
];

function StatCard({ value, label, highlight }) {
  return (
    <div className="card" style={{
      textAlign: "center",
      borderTop: highlight ? `3px solid var(--color-${highlight === "warn" ? "warn" : highlight === "danger" ? "danger" : "primary"})` : undefined,
    }}>
      <div style={{ fontSize: "2rem", fontWeight: 800, color: `var(--color-${highlight === "warn" ? "warn" : highlight === "danger" ? "danger" : "primary"})` }}>
        {value ?? "—"}
      </div>
      <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}>{label}</div>
    </div>
  );
}

function OverviewPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AdminAPI.stats()
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h2 style={{ marginBottom: "0.4rem" }}>Admin Overview</h2>
      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        Live counts from the database. All actions are immediately persisted.
      </p>

      {loading ? (
        <p className="muted">Loading stats…</p>
      ) : !stats ? (
        <p className="error-text">Could not load statistics.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "0.85rem" }}>
          <StatCard value={stats.users_total} label="Total users" />
          <StatCard value={stats.users_recent} label="New users (7d)" highlight="primary" />
          <StatCard value={stats.places_total} label="Places" />
          <StatCard value={stats.venues_pending} label="Venues pending" highlight={stats.venues_pending > 0 ? "warn" : null} />
          <StatCard value={stats.images_pending} label="Images pending" highlight={stats.images_pending > 0 ? "warn" : null} />
          <StatCard value={stats.images_flagged} label="Images flagged" highlight={stats.images_flagged > 0 ? "danger" : null} />
          <StatCard value={stats.attributes_pending} label="Attributes pending" highlight={stats.attributes_pending > 0 ? "warn" : null} />
        </div>
      )}

      <div className="card" style={{ marginTop: "2rem", background: "var(--color-primary-light)", border: "1px solid var(--color-primary)" }}>
        <h3 style={{ color: "var(--color-primary-dark)", marginBottom: "0.5rem" }}>Quick links</h3>
        <p style={{ margin: 0, fontSize: "0.9rem" }}>
          The Django built-in admin is also available at{" "}
          <a href="/admin/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary-dark)", fontWeight: 600 }}>
            /admin/ ↗
          </a>.
          Use the panels on the left for a streamlined management experience inside RAMP.
        </p>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  if (loading) return null;

  // Guard: only staff or admin-type users may access this page
  if (!user || (!user.is_staff && user.user_type !== "admin")) {
    return <Navigate to="/" replace />;
  }

  function renderPanel() {
    switch (activeSection) {
      case "overview":      return <OverviewPanel />;
      case "users":         return <UsersPanel />;
      case "venues":        return <VenuesPanel />;
      case "places":        return <PlacesPanel />;
      case "categories":    return <PlaceCategoriesPanel />;
      case "facility-types": return <FacilityTypesPanel />;
      case "attributes":    return <AttributesPanel />;
      case "images":        return <ImagesPanel />;
      case "config":        return <SystemConfigPanel />;
      default:              return <OverviewPanel />;
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 57px)" }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        padding: "1.5rem 0",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}>
        <div style={{ padding: "0 1.2rem 1rem", borderBottom: "1px solid var(--color-border)", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{
              width: 28, height: 28, borderRadius: 6,
              background: "var(--color-primary)", color: "#fff",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.8rem", fontWeight: 800,
            }}>A</span>
            <strong style={{ fontSize: "0.95rem" }}>Admin Panel</strong>
          </div>
          <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.78rem" }}>{user.username}</p>
        </div>

        {NAV_SECTIONS.map((section) => {
          const isActive = activeSection === section.key;
          return (
            <button
              key={section.key}
              id={`admin-nav-${section.key}`}
              onClick={() => setActiveSection(section.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                padding: "0.6rem 1.2rem",
                background: isActive ? "var(--color-primary-light)" : "transparent",
                color: isActive ? "var(--color-primary-dark)" : "var(--color-text)",
                border: "none",
                borderRight: isActive ? "3px solid var(--color-primary)" : "3px solid transparent",
                borderRadius: 0,
                textAlign: "left",
                fontWeight: isActive ? 700 : 400,
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <span aria-hidden="true">{section.icon}</span>
              {section.label}
            </button>
          );
        })}
      </aside>

      {/* ── Main content ── */}
      <main style={{
        flex: 1,
        padding: "2rem 2.5rem",
        overflowY: "auto",
        background: "var(--color-bg)",
        maxWidth: "100%",
      }}>
        <Suspense fallback={<p className="muted">Loading panel…</p>}>
          {renderPanel()}
        </Suspense>
      </main>
    </div>
  );
}
