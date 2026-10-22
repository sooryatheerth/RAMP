import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthAPI, GamificationAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfidenceBadge from "../components/ConfidenceBadge";
import RewardTierBadge from "../components/RewardTierBadge";
import BadgeItem from "../components/BadgeItem";

const S = {
  page: { maxWidth: 940, margin: "0 auto", padding: "2rem 1.25rem 4rem" },
  section: {
    background: "#fff",
    border: "1px solid var(--color-border)",
    borderRadius: 14,
    padding: "1.5rem",
    marginBottom: "1.5rem",
    boxShadow: "var(--shadow)",
  },
  sectionTitle: { margin: "0 0 1rem", fontSize: "1.15rem", fontWeight: 700, color: "var(--color-primary-dark)" },
  avatar: {
    width: 68, height: 68, borderRadius: "50%",
    background: "var(--color-primary)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "1.8rem", fontWeight: 700, flexShrink: 0,
    boxShadow: "0 2px 8px rgba(15, 110, 86, 0.25)",
  },
  badge: (type) => ({
    display: "inline-block",
    padding: "0.2em 0.65em",
    borderRadius: 999,
    fontSize: "0.8rem",
    fontWeight: 700,
    background: type === "admin" ? "#fde8e8" : type === "moderator" ? "#e8f0fd" : "var(--color-primary-light)",
    color: type === "admin" ? "var(--color-danger)" : type === "moderator" ? "#1a4db5" : "var(--color-primary-dark)",
  }),
  input: { width: "100%", marginTop: "0.3rem" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  placeCard: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0.75rem 1rem", borderRadius: 8,
    border: "1px solid var(--color-border)", marginBottom: "0.5rem",
  },
};

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "" });
  const [saving, setSaving] = useState(false);

  // Change password state
  const [pwForm, setPwForm] = useState({ old_password: "", new_password: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  // Gamification state
  const [badgesData, setBadgesData] = useState(null);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [badgeFilter, setBadgeFilter] = useState("all"); // "all", "unlocked", "locked"

  // My places
  const [myPlaces, setMyPlaces] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(true);

  // My attributes
  const [myAttrs, setMyAttrs] = useState([]);
  const [attrsLoading, setAttrsLoading] = useState(true);

  // Saved places
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);

  useEffect(() => {
    if (user) setForm({ first_name: user.first_name || "", last_name: user.last_name || "", email: user.email || "" });
  }, [user]);

  function loadSavedPlaces() {
    AuthAPI.savedPlaces()
      .then((r) => setSavedPlaces(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setSavedLoading(false));
  }

  useEffect(() => {
    // Fetch user places & attributes
    AuthAPI.myPlaces()
      .then((r) => setMyPlaces(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setPlacesLoading(false));

    AuthAPI.myAttributes()
      .then((r) => setMyAttrs(r.data.results || r.data))
      .catch(() => {})
      .finally(() => setAttrsLoading(false));

    loadSavedPlaces();

    // Fetch gamification badges & tier
    GamificationAPI.myBadges()
      .then((r) => setBadgesData(r.data))
      .catch(() => {})
      .finally(() => setBadgesLoading(false));
  }, []);

  async function handleRemoveSaved(placeId) {
    try {
      await AuthAPI.removeSavedPlace(placeId);
      setSavedPlaces((prev) => prev.filter((item) => item.place?.id !== placeId));
      toast.success("Place removed from bookmarks.");
    } catch {
      toast.error("Could not remove bookmark.");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await AuthAPI.updateMe(form);
      setUser((u) => ({ ...u, ...data }));
      toast.success("Profile updated successfully.");
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (pwForm.new_password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    try {
      await AuthAPI.changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password });
      toast.success("Password changed successfully.");
      setPwForm({ old_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  }

  if (!user) return null;

  const tier = badgesData?.tier;
  const stats = badgesData?.stats || {
    places_count: myPlaces.length,
    verifications_count: 0,
    attributes_count: myAttrs.length,
    reputation_score: user.reputation_score,
  };
  const earnedBadges = badgesData?.badges || [];
  const milestones = badgesData?.milestones || [];

  const earnedMap = new Map();
  earnedBadges.forEach((ub) => {
    earnedMap.set(ub.badge.code, ub);
  });

  // Filtered milestones / badges
  const filteredMilestones = milestones.filter((m) => {
    if (badgeFilter === "unlocked") return m.completed;
    if (badgeFilter === "locked") return !m.completed;
    return true;
  });

  const unlockedCount = milestones.filter((m) => m.completed).length;

  return (
    <main style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Contributor Dashboard</h1>
        <Link to="/leaderboard">
          <button className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <span>🏆</span> View Community Leaderboard →
          </button>
        </Link>
      </div>

      {/* ── Contributor Status & Reward Tier Card ── */}
      <section
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
          border: `2px solid ${tier?.color || "var(--color-primary)"}`,
          borderRadius: 16,
          padding: "1.5rem",
          marginBottom: "1.5rem",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.2rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "2rem" }}>{tier?.icon || "🥉"}</span>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.35rem" }}>{tier?.name || "Bronze Contributor"}</h2>
                <span className="muted" style={{ fontSize: "0.9rem", fontStyle: "italic" }}>
                  "{tier?.title || "Novice Scout"}"
                </span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-primary-dark)" }}>
              {user.reputation_score}
            </span>
            <span className="muted" style={{ fontSize: "0.88rem", display: "block" }}>
              Reputation Points
            </span>
          </div>
        </div>

        {/* Tier progress bar */}
        {tier && (
          <div style={{ marginBottom: "1.2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.35rem" }}>
              <span style={{ fontWeight: 600 }}>
                {tier.next_tier_name ? (
                  <>
                    Next tier: <strong>{tier.next_tier_icon} {tier.next_tier_name}</strong>
                  </>
                ) : (
                  <>Top reward tier achieved! 👑</>
                )}
              </span>
              <span className="muted">
                {tier.points_to_next > 0
                  ? `${tier.points_to_next} points to next tier`
                  : "Maximum tier reached"}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 10,
                background: "#e2e8f0",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${tier.progress_percent}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${tier.color}, var(--color-primary))`,
                  borderRadius: 999,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Quick contribution counters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "0.75rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--color-surface)", borderRadius: 8, border: "1px solid var(--color-border)" }}>
            <span style={{ fontSize: "1.2rem" }}>📍</span>
            <strong style={{ display: "block", fontSize: "1.2rem" }}>{stats.places_count}</strong>
            <span className="muted" style={{ fontSize: "0.78rem" }}>Places Mapped</span>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--color-surface)", borderRadius: 8, border: "1px solid var(--color-border)" }}>
            <span style={{ fontSize: "1.2rem" }}>🔍</span>
            <strong style={{ display: "block", fontSize: "1.2rem" }}>{stats.verifications_count}</strong>
            <span className="muted" style={{ fontSize: "0.78rem" }}>Verifications</span>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--color-surface)", borderRadius: 8, border: "1px solid var(--color-border)" }}>
            <span style={{ fontSize: "1.2rem" }}>📝</span>
            <strong style={{ display: "block", fontSize: "1.2rem" }}>{stats.attributes_count}</strong>
            <span className="muted" style={{ fontSize: "0.78rem" }}>Attributes</span>
          </div>
          <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--color-surface)", borderRadius: 8, border: "1px solid var(--color-border)" }}>
            <span style={{ fontSize: "1.2rem" }}>🏆</span>
            <strong style={{ display: "block", fontSize: "1.2rem" }}>{unlockedCount} / {milestones.length}</strong>
            <span className="muted" style={{ fontSize: "0.78rem" }}>Badges Earned</span>
          </div>
        </div>

        {/* Tier perks */}
        {tier?.perks?.length > 0 && (
          <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--color-border)", fontSize: "0.85rem" }}>
            <span className="muted" style={{ fontWeight: 600 }}>Active Tier Privileges:</span>
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem", color: "var(--color-text-muted)" }}>
              {tier.perks.map((p, idx) => (
                <li key={idx} style={{ marginBottom: "0.2rem" }}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Badges & Achievements Section ── */}
      <section style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.2rem" }}>
          <div>
            <h3 style={{ ...S.sectionTitle, margin: 0 }}>🏆 Contributor Achievements & Badges</h3>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
              Unlock badges by submitting verified accessibility features and peer reviews.
            </p>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: "0.4rem", background: "#f1f5f9", padding: "0.25rem", borderRadius: 8 }}>
            {[
              { id: "all", label: `All (${milestones.length})` },
              { id: "unlocked", label: `Unlocked (${unlockedCount})` },
              { id: "locked", label: `In Progress (${milestones.length - unlockedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setBadgeFilter(tab.id)}
                style={{
                  padding: "0.3em 0.75em",
                  borderRadius: 6,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  background: badgeFilter === tab.id ? "var(--color-surface)" : "transparent",
                  color: badgeFilter === tab.id ? "var(--color-primary-dark)" : "var(--color-text-muted)",
                  boxShadow: badgeFilter === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  border: "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {badgesLoading ? (
          <p className="muted">Loading achievements…</p>
        ) : filteredMilestones.length === 0 ? (
          <p className="muted">No badges match this filter.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            {filteredMilestones.map((m) => {
              const ub = earnedMap.get(m.code);
              return (
                <BadgeItem
                  key={m.code}
                  badge={m}
                  isUnlocked={m.completed}
                  awardedAt={ub?.awarded_at}
                  progress={{
                    current_value: m.current_value,
                    target_value: m.target_value,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Identity card ── */}
      <div style={S.section}>
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
          <div style={S.avatar}>{user.username[0].toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>{user.username}</h2>
              <span style={S.badge(user.user_type)}>{user.user_type}</span>
              {tier && (
                <RewardTierBadge tier={tier.tier} title={tier.title} size="sm" />
              )}
              {user.is_verified_email
                ? <span style={{ color: "var(--color-primary-dark)", fontSize: "0.82rem", fontWeight: 600 }}>✓ Email verified</span>
                : <span style={{ color: "var(--color-warn)", fontSize: "0.82rem" }}>⚠ Email not verified</span>
              }
            </div>
            <p className="muted" style={{ margin: "0.3rem 0 0", fontSize: "0.9rem" }}>{user.email}</p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
              Reputation: <strong>{user.reputation_score}</strong> pts
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setEditing((e) => !e)} style={{ flexShrink: 0 }}>
            {editing ? "Cancel" : "✏ Edit"}
          </button>
        </div>

        {editing && (
          <form onSubmit={handleSave} style={{ marginTop: "1.25rem", borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem" }}>
            <div style={S.row}>
              <div className="field">
                <label htmlFor="p-first">First name</label>
                <input id="p-first" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="p-last">Last name</label>
                <input id="p-last" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="p-email">Email address</label>
              <input id="p-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
              <button className="btn-secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* ── Change password ── */}
      <div style={S.section}>
        <h3 style={S.sectionTitle}>🔒 Change Password</h3>
        <form onSubmit={handlePasswordChange}>
          <div className="field">
            <label htmlFor="pw-old">Current password</label>
            <input id="pw-old" type="password" value={pwForm.old_password} required
              onChange={(e) => setPwForm((f) => ({ ...f, old_password: e.target.value }))} />
          </div>
          <div style={S.row}>
            <div className="field">
              <label htmlFor="pw-new">New password</label>
              <input id="pw-new" type="password" value={pwForm.new_password} required minLength={8}
                onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" type="password" value={pwForm.confirm} required
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={pwSaving}>
            {pwSaving ? "Changing…" : "Change password"}
          </button>
        </form>
      </div>

      {/* ── Saved Places / Bookmarks (Feature 5) ── */}
      <div style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ ...S.sectionTitle, margin: 0 }}>❤️ Saved Accessible Places</h3>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
              Quick access to your bookmarked venues and personal navigation notes
            </p>
          </div>
          <span className="muted" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            {savedPlaces.length} {savedPlaces.length === 1 ? "place" : "places"} saved
          </span>
        </div>

        {savedLoading ? (
          <p className="muted">Loading saved places…</p>
        ) : savedPlaces.length === 0 ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <p className="muted" style={{ margin: 0 }}>You haven't bookmarked any accessible places yet.</p>
            <Link to="/places">
              <button className="btn-secondary" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
                Browse accessible places
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {savedPlaces.map((item) => {
              const p = item.place;
              if (!p) return null;
              return (
                <div key={item.id} style={{ ...S.placeCard, padding: "0.9rem 1.1rem" }}>
                  <div style={{ flex: 1, paddingRight: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Link to={`/places/${p.id}`} style={{ fontWeight: 700, fontSize: "1rem", textDecoration: "none", color: "var(--color-text)" }}>
                        {p.name}
                      </Link>
                      <span className="muted" style={{ fontSize: "0.8rem" }}>· {p.category_name}</span>
                    </div>
                    <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
                      {p.city ? `${p.city} · ` : ""}{p.address || ""}
                    </p>
                    {item.notes && (
                      <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "var(--color-primary-dark)", fontStyle: "italic" }}>
                        Note: {item.notes}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                    <ConfidenceBadge score={p.overall_accessibility_score} />
                    <button
                      onClick={() => handleRemoveSaved(p.id)}
                      title="Remove bookmark"
                      aria-label="Remove bookmark"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-danger)",
                        cursor: "pointer",
                        fontSize: "1.1rem",
                        padding: "0.2rem",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── My places ── */}
      <div style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ ...S.sectionTitle, margin: 0 }}>📍 My Submitted Places</h3>
          <Link to="/places/new"><button className="btn-primary" style={{ fontSize: "0.85rem", padding: "0.4em 0.9em" }}>+ Add place</button></Link>
        </div>
        {placesLoading ? (
          <p className="muted">Loading…</p>
        ) : myPlaces.length === 0 ? (
          <p className="muted">You haven't submitted any places yet.</p>
        ) : (
          myPlaces.map((p) => (
            <div key={p.id} style={S.placeCard}>
              <div>
                <Link to={`/places/${p.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>{p.name}</Link>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{p.category_name} · {p.city}</p>
              </div>
              <ConfidenceBadge score={p.overall_accessibility_score} />
            </div>
          ))
        )}
      </div>

      {/* ── My attribute submissions ── */}
      <div style={S.section}>
        <h3 style={S.sectionTitle}>✏ My Attribute Submissions</h3>
        {attrsLoading ? (
          <p className="muted">Loading…</p>
        ) : myAttrs.length === 0 ? (
          <p className="muted">No attribute submissions yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Attribute</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Value</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Status</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {myAttrs.slice(0, 20).map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{a.attribute_name}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>
                    {a.value_boolean != null ? (a.value_boolean ? "Yes" : "No") : a.value_number ?? a.value_text ?? "—"}
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>
                    <span style={{
                      padding: "0.15em 0.5em", borderRadius: 999, fontSize: "0.8rem", fontWeight: 600,
                      background: a.verification_status === "verified" ? "var(--color-primary-light)"
                        : a.verification_status === "disputed" ? "var(--color-warn-light)"
                        : a.verification_status === "rejected" ? "var(--color-danger-light)"
                        : "#f0f0f0",
                      color: a.verification_status === "verified" ? "var(--color-primary-dark)"
                        : a.verification_status === "disputed" ? "var(--color-warn)"
                        : a.verification_status === "rejected" ? "var(--color-danger)"
                        : "#555",
                    }}>
                      {a.verification_status}
                    </span>
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem", color: "var(--color-text-muted)", fontSize: "0.82rem" }}>
                    {new Date(a.submitted_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
