import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = user && (user.is_staff || user.user_type === "admin");

  function handleLogout() {
    logout();
    navigate("/");
    setMenuOpen(false);
  }

  const navLinkStyle = (path) => {
    const isActive = location.pathname === path || (path === "/places" && location.pathname.startsWith("/places"));
    return {
      textDecoration: "none",
      padding: "0.42rem 0.82rem",
      borderRadius: "8px",
      fontSize: "0.92rem",
      fontWeight: isActive ? "700" : "500",
      color: isActive ? "var(--color-primary-dark)" : "var(--color-text-secondary)",
      background: isActive ? "var(--color-primary-light)" : "transparent",
      transition: "all 0.16s ease",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.35rem",
    };
  };

  return (
    <header className="app-header">
      <nav className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.25rem", gap: "0.75rem" }}>
        {/* Left: logo + back */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {!isHome && (
            <button
              className="btn-secondary"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              style={{ padding: "0.4em 0.7em", display: "flex", alignItems: "center", fontSize: "0.85rem" }}
            >
              ← Back
            </button>
          )}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.55em", textDecoration: "none", color: "var(--color-text)" }}>
            <span aria-hidden="true" style={{
              width: 32, height: 32, borderRadius: 10, background: "var(--color-primary-gradient)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: "1rem",
              boxShadow: "0 2px 8px rgba(15, 118, 110, 0.35)",
            }}>R</span>
            <strong style={{ fontSize: "1.2rem", letterSpacing: "-0.025em", fontFamily: "var(--font-heading)" }}>RAMP</strong>
          </Link>
        </div>

        {/* Desktop links */}
        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {!isHome && <Link to="/" style={navLinkStyle("/")}>Home</Link>}
          <Link to="/places" style={navLinkStyle("/places")}>Explore</Link>
          <Link to="/leaderboard" style={navLinkStyle("/leaderboard")}>
            <span>🏆</span> Leaderboard
          </Link>

          {user && (
            <Link to="/profile" style={navLinkStyle("/saved")} title="My Saved Places">
              <span>❤️</span> Saved
            </Link>
          )}

          {isAdmin && (
            <Link to="/admin" style={{
              textDecoration: "none",
              background: "linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)",
              color: "var(--color-primary-dark)",
              border: "1px solid var(--color-primary-border)",
              padding: "0.38em 0.85em",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: "0.88rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3em",
              boxShadow: "var(--shadow-xs)",
            }}>
              ⚙ Admin
            </Link>
          )}

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginLeft: "0.5rem" }}>
              <Link to="/profile" style={{
                textDecoration: "none",
                display: "flex", alignItems: "center", gap: "0.45em",
                padding: "0.3em 0.65em 0.3em 0.35em",
                borderRadius: "999px",
                background: "#FFFFFF",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-xs)",
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--color-primary-gradient)", color: "#fff",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.85rem", fontWeight: 700,
                  boxShadow: "0 1px 4px rgba(15,118,110,0.25)",
                }}>
                  {user.username[0].toUpperCase()}
                </span>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-text)" }}>{user.username}</span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    background: "var(--color-warn-light)",
                    color: "var(--color-warn-dark)",
                    border: "1px solid var(--color-warn-border)",
                    padding: "0.15em 0.55em",
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                  title="Reputation Score"
                >
                  ⭐ {user.reputation_score || 0}
                </span>
              </Link>
              <button className="btn-secondary" onClick={handleLogout} style={{ fontSize: "0.85rem", padding: "0.45em 0.9em" }}>
                Log out
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginLeft: "0.5rem" }}>
              <Link to="/login" style={{ textDecoration: "none", color: "var(--color-text-secondary)", fontWeight: 600, padding: "0.45em 0.8em" }}>Log in</Link>
              <Link to="/register"><button className="btn-primary" style={{ fontSize: "0.88rem", padding: "0.45em 1.1em" }}>Sign up</button></Link>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="hamburger-btn btn-secondary"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          style={{ display: "none", padding: "0.45em 0.7em", fontSize: "1.1rem" }}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="mobile-menu" style={{
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "1rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}>
          <Link to="/places" className="btn-link" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>Explore places</Link>
          <Link to="/leaderboard" className="btn-link" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>🏆 Leaderboard & Achievements</Link>
          {isAdmin && (
            <Link to="/admin" className="btn-link" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>⚙ Admin</Link>
          )}
          {user ? (
            <>
              <Link to="/profile" className="btn-link" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>❤️ Saved places</Link>
              <Link to="/profile" className="btn-link" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>👤 My profile</Link>
              <button className="btn-secondary" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-link" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>Log in</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)}><button className="btn-primary" style={{ width: "100%" }}>Sign up</button></Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
