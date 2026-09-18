import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
      <nav className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.25rem", gap: "0.75rem" }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
          {!isHome && <Link to="/" className="btn-link" style={{ textDecoration: "none" }}>Home</Link>}
          <Link to="/places" className="btn-link" style={{ textDecoration: "none" }}>Explore places</Link>
          {user ? (
            <>
              <span className="muted" style={{ fontSize: "0.9rem" }}>Hi, {user.username}</span>
              <button className="btn-secondary" onClick={() => { logout(); navigate("/"); }}>
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
      </nav>
    </header>
  );
}
