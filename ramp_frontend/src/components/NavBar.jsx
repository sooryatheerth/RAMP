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

  return (
    <header style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", position: "sticky", top: 0, zIndex: 100 }}>
      <nav className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.25rem", gap: "0.75rem" }}>
        {/* Left: logo + back */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {!isHome && (
            <button
              className="btn-secondary"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              style={{ padding: "0.45em 0.7em", display: "flex", alignItems: "center" }}
            >
              ← Back
            </button>
          )}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.5em", textDecoration: "none", color: "var(--color-text)" }}>
            <span aria-hidden="true" style={{
              width: 30, height: 30, borderRadius: 8, background: "var(--color-primary)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: "0.95rem",
            }}>R</span>
            <strong style={{ fontSize: "1.1rem" }}>RAMP</strong>
          </Link>
        </div>

        {/* Desktop links */}
        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
          {!isHome && <Link to="/" className="btn-link" style={{ textDecoration: "none" }}>Home</Link>}
          <Link to="/places" className="btn-link" style={{ textDecoration: "none" }}>Explore</Link>
          <Link to="/leaderboard" className="btn-link" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3em" }}>
            <span>🏆</span> Leaderboard
          </Link>

          {user && (
            <Link to="/profile" className="btn-link" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.25em" }} title="My Saved Places">
              <span>❤️</span> Saved
            </Link>
          )}

          {isAdmin && (
            <Link to="/admin" className="btn-link" style={{
              textDecoration: "none",
              background: "var(--color-primary-light)",
              color: "var(--color-primary-dark)",
              padding: "0.35em 0.8em",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: "0.875rem",
            }}>
              ⚙ Admin
            </Link>
          )}

          {user ? (
            <>
              <Link to="/profile" className="btn-link" style={{
                textDecoration: "none",
                display: "flex", alignItems: "center", gap: "0.4em",
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--color-primary)", color: "#fff",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.85rem", fontWeight: 700,
                }}>
                  {user.username[0].toUpperCase()}
                </span>
                <span className="muted" style={{ fontSize: "0.9rem" }}>{user.username}</span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    background: "var(--color-primary-light)",
                    color: "var(--color-primary-dark)",
                    padding: "0.15em 0.5em",
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                  title="Reputation Score"
                >
                  ⭐ {user.reputation_score || 0}
                </span>
              </Link>
              <button className="btn-secondary" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-link" style={{ textDecoration: "none" }}>Log in</Link>
              <Link to="/register"><button className="btn-primary">Sign up</button></Link>
            </>
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
