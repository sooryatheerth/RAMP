import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GamificationAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import RewardTierBadge from "../components/RewardTierBadge";

export default function Leaderboard() {
  const { user } = useAuth();
  const [rankingType, setRankingType] = useState("reputation");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    GamificationAPI.leaderboard({ type: rankingType })
      .then((res) => {
        setData(res.data);
        setError(null);
      })
      .catch(() => {
        setError("Failed to load community leaderboard. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [rankingType]);

  const leaderboard = data?.leaderboard || [];
  const userRank = data?.user_rank;
  const stats = data?.community_stats || { total_contributors: 0, total_places: 0, total_verifications: 0 };
  const tiers = data?.reward_tiers || [];

  const topThree = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);

  return (
    <main className="container" style={{ padding: "2rem 1.25rem 4rem" }}>
      {/* ── Header & Community Highlights ── */}
      <section style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span style={{ fontSize: "1.6rem" }}>🏆</span>
          <span className="muted" style={{ fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", fontSize: "0.82rem" }}>
            Community Recognition
          </span>
        </div>
        <h1 style={{ margin: "0.2rem 0 0.5rem" }}>Community Leaderboard & Achievements</h1>
        <p style={{ maxWidth: 760, color: "var(--color-text-muted)", fontSize: "1.05rem", lineHeight: 1.5 }}>
          Honoring the dedicated contributors mapping accessible places, verifying accessibility features,
          and ensuring reliable, peer-reviewed navigation for everyone.
        </p>

        {/* Global summary counters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginTop: "1.5rem",
          }}
        >
          <div className="card" style={{ padding: "1rem 1.25rem", borderLeft: "4px solid var(--color-primary)" }}>
            <span className="muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>Active Contributors</span>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "0.2rem", color: "var(--color-primary-dark)" }}>
              {stats.total_contributors}
            </div>
          </div>
          <div className="card" style={{ padding: "1rem 1.25rem", borderLeft: "4px solid #f59e0b" }}>
            <span className="muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>Places Mapped</span>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "0.2rem", color: "#b45309" }}>
              {stats.total_places}
            </div>
          </div>
          <div className="card" style={{ padding: "1rem 1.25rem", borderLeft: "4px solid #0ea5e9" }}>
            <span className="muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>Attribute Verifications</span>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "0.2rem", color: "#0369a1" }}>
              {stats.total_verifications}
            </div>
          </div>
          <div className="card" style={{ padding: "1rem 1.25rem", borderLeft: "4px solid #8b5cf6" }}>
            <span className="muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>Points Rewards</span>
            <div style={{ fontSize: "0.85rem", marginTop: "0.2rem", color: "var(--color-text)" }}>
              <strong>+5 pts</strong> submitter · <strong>+2 pts</strong> verifier
            </div>
          </div>
        </div>
      </section>

      {/* ── Authenticated User's Personal Ranking Card ── */}
      {user && userRank && (
        <section
          style={{
            background: "linear-gradient(135deg, var(--color-primary-light), #f0fdf4)",
            border: "1.5px solid var(--color-primary)",
            borderRadius: 14,
            padding: "1.2rem 1.5rem",
            marginBottom: "2rem",
            boxShadow: "0 4px 16px rgba(15, 110, 86, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1.2rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--color-primary)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(15, 110, 86, 0.25)",
              }}
            >
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "1.15rem" }}>{user.username}</strong>
                <RewardTierBadge tier={userRank.tier} title={userRank.tier_title} size="sm" />
                <span
                  style={{
                    background: "var(--color-surface)",
                    color: "var(--color-primary-dark)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: 999,
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    border: "1px solid var(--color-border)",
                  }}
                >
                  Rank #{userRank.rank}
                </span>
              </div>
              <p className="muted" style={{ margin: "0.3rem 0 0", fontSize: "0.88rem" }}>
                Reputation: <strong style={{ color: "var(--color-text)" }}>{userRank.reputation_score} pts</strong> ·{" "}
                Mapped: <strong>{userRank.places_count} places</strong> ·{" "}
                Verifications: <strong>{userRank.verifications_count}</strong> ·{" "}
                Badges: <strong>{userRank.badges_count}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            <Link to="/profile">
              <button className="btn-primary" style={{ padding: "0.5em 1.1em", fontSize: "0.9rem" }}>
                My Badges & Progress →
              </button>
            </Link>
          </div>
        </section>
      )}

      {/* ── Filter Tabs ── */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          overflowX: "auto",
          paddingBottom: "0.25rem",
        }}
      >
        {[
          { key: "reputation", label: "🌟 Overall Reputation", desc: "Combined peer points" },
          { key: "verifications", label: "🔍 Top Verifiers", desc: "Attribute audits" },
          { key: "places", label: "📍 Top Mappers", desc: "Places added" },
          { key: "badges", label: "🏆 Top Achievers", desc: "Badges unlocked" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setRankingType(tab.key)}
            style={{
              padding: "0.6em 1.1em",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: "0.9rem",
              background: rankingType === tab.key ? "var(--color-primary)" : "var(--color-surface)",
              color: rankingType === tab.key ? "#fff" : "var(--color-text)",
              border: `1.5px solid ${rankingType === tab.key ? "var(--color-primary)" : "var(--color-border)"}`,
              transition: "all 0.15s ease",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <p className="muted">Loading leaderboard standings…</p>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--color-danger)" }}>
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* ── Top 3 Podium Showcase ── */}
          {topThree.length > 0 && (
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "1.25rem",
                marginBottom: "2.5rem",
              }}
            >
              {topThree.map((contributor) => {
                const isFirst = contributor.rank === 1;
                const isSecond = contributor.rank === 2;
                const isThird = contributor.rank === 3;

                const medalColor = isFirst ? "#f59e0b" : isSecond ? "#94a3b8" : "#cd7f32";
                const medalIcon = isFirst ? "🥇" : isSecond ? "🥈" : "🥉";
                const medalBorder = isFirst ? "#fcd34d" : isSecond ? "#cbd5e1" : "#fde68a";

                return (
                  <div
                    key={contributor.id}
                    className="card"
                    style={{
                      position: "relative",
                      borderRadius: 16,
                      border: `2px solid ${contributor.is_current_user ? "var(--color-primary)" : medalBorder}`,
                      background: isFirst
                        ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)"
                        : "var(--color-surface)",
                      boxShadow: isFirst
                        ? "0 8px 24px rgba(245, 158, 11, 0.18)"
                        : "var(--shadow)",
                      padding: "1.6rem 1.4rem",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    {/* Crown for #1 */}
                    {isFirst && (
                      <span aria-hidden="true" style={{ fontSize: "1.8rem", position: "absolute", top: -18 }}>
                        👑
                      </span>
                    )}

                    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {/* Avatar with medal icon badge */}
                      <div style={{ position: "relative", marginBottom: "0.8rem", marginTop: isFirst ? "0.4rem" : 0 }}>
                        <div
                          style={{
                            width: isFirst ? 68 : 56,
                            height: isFirst ? 68 : 56,
                            borderRadius: "50%",
                            background: medalColor,
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: isFirst ? "1.8rem" : "1.4rem",
                            fontWeight: 800,
                            boxShadow: `0 4px 12px ${medalColor}40`,
                          }}
                        >
                          {contributor.username[0].toUpperCase()}
                        </div>
                        <span
                          style={{
                            position: "absolute",
                            bottom: -4,
                            right: -4,
                            fontSize: "1.3rem",
                            background: "var(--color-surface)",
                            borderRadius: "50%",
                            lineHeight: 1,
                            padding: "0.15rem",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          }}
                        >
                          {medalIcon}
                        </span>
                      </div>

                      <h3 style={{ margin: "0 0 0.3rem", fontSize: "1.15rem" }}>
                        {contributor.username}
                        {contributor.is_current_user && (
                          <span style={{ fontSize: "0.78rem", color: "var(--color-primary)", marginLeft: "0.35rem" }}>(You)</span>
                        )}
                      </h3>

                      <RewardTierBadge tier={contributor.tier} title={contributor.tier_title} size="sm" />

                      <div style={{ margin: "0.9rem 0 0.5rem" }}>
                        <span style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--color-text)" }}>
                          {contributor.reputation_score}
                        </span>
                        <span className="muted" style={{ fontSize: "0.85rem", marginLeft: "0.3rem" }}>
                          reputation pts
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: "1rem", fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                        <span>📍 {contributor.places_count} places</span>
                        <span>🔍 {contributor.verifications_count} verified</span>
                      </div>
                    </div>

                    {/* Top Badges Preview */}
                    {contributor.top_badges?.length > 0 && (
                      <div
                        style={{
                          marginTop: "1.1rem",
                          paddingTop: "0.8rem",
                          borderTop: "1px solid var(--color-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.4rem",
                          width: "100%",
                        }}
                      >
                        <span className="muted" style={{ fontSize: "0.75rem", marginRight: "0.2rem" }}>Badges:</span>
                        {contributor.top_badges.map((b) => (
                          <span
                            key={b.code}
                            title={`${b.name} (${b.tier})`}
                            style={{
                              fontSize: "1.15rem",
                              background: "var(--color-surface)",
                              padding: "0.15rem 0.35rem",
                              borderRadius: 6,
                              border: "1px solid var(--color-border)",
                            }}
                          >
                            {b.icon}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* ── Complete Standings Table ── */}
          <section className="card" style={{ padding: "1.25rem", overflowX: "auto", marginBottom: "3rem" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.15rem" }}>All Contributor Standings</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                  <th style={{ padding: "0.6rem 0.75rem", width: 70 }}>Rank</th>
                  <th style={{ padding: "0.6rem 0.75rem" }}>Contributor</th>
                  <th style={{ padding: "0.6rem 0.75rem" }}>Reward Tier</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>Places Mapped</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>Verifications</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>Badges</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>Reputation</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((c) => {
                  const isTopThree = c.rank <= 3;
                  const medal = c.rank === 1 ? "🥇" : c.rank === 2 ? "🥈" : c.rank === 3 ? "🥉" : null;

                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        background: c.is_current_user
                          ? "var(--color-primary-light)"
                          : "transparent",
                        fontWeight: c.is_current_user ? 700 : 400,
                      }}
                    >
                      <td style={{ padding: "0.75rem 0.75rem" }}>
                        {medal ? (
                          <span style={{ fontSize: "1.2rem" }}>{medal}</span>
                        ) : (
                          <span
                            style={{
                              display: "inline-block",
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: "#f1f5f9",
                              color: "#475569",
                              textAlign: "center",
                              lineHeight: "28px",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                            }}
                          >
                            {c.rank}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem 0.75rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "var(--color-primary)",
                              color: "#fff",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.9rem",
                              fontWeight: 700,
                            }}
                          >
                            {c.username[0].toUpperCase()}
                          </span>
                          <span>
                            {c.username}
                            {c.is_current_user && (
                              <span style={{ color: "var(--color-primary-dark)", fontSize: "0.8rem", marginLeft: "0.3rem" }}>
                                (You)
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 0.75rem" }}>
                        <RewardTierBadge tier={c.tier} title={c.tier_title} size="sm" />
                      </td>
                      <td style={{ padding: "0.75rem 0.75rem", textAlign: "center" }}>
                        {c.places_count}
                      </td>
                      <td style={{ padding: "0.75rem 0.75rem", textAlign: "center" }}>
                        {c.verifications_count}
                      </td>
                      <td style={{ padding: "0.75rem 0.75rem", textAlign: "center" }}>
                        {c.top_badges?.length > 0 ? (
                          <span style={{ display: "inline-flex", gap: "0.2rem" }}>
                            {c.top_badges.map((b) => (
                              <span key={b.code} title={b.name} style={{ fontSize: "1.05rem" }}>{b.icon}</span>
                            ))}
                            {c.badges_count > c.top_badges.length && (
                              <span className="muted" style={{ fontSize: "0.75rem", alignSelf: "center" }}>
                                +{c.badges_count - c.top_badges.length}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem 0.75rem", textAlign: "right", fontWeight: 700, color: "var(--color-primary-dark)" }}>
                        {c.reputation_score} pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* ── Reward Tiers & Milestone Roadmaps ── */}
          <section style={{ marginTop: "3rem" }}>
            <h2 style={{ marginBottom: "0.5rem" }}>🏅 Contributor Reward Tiers & Perks</h2>
            <p className="muted" style={{ marginBottom: "1.5rem" }}>
              As your reputation grows from helpful contributions and verified accessibility data, you climb the ranks
              and unlock higher status and community privileges.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1.2rem",
              }}
            >
              {tiers.map((tier) => (
                <div
                  key={tier.tier}
                  className="card"
                  style={{
                    borderRadius: 14,
                    border: `1.5px solid ${tier.color}`,
                    padding: "1.25rem 1.4rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "1.8rem" }}>{tier.icon}</span>
                      <span
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          background: tier.bg_color,
                          color: tier.badge_color,
                          padding: "0.2rem 0.6rem",
                          borderRadius: 999,
                        }}
                      >
                        {tier.max_score ? `${tier.min_score} – ${tier.max_score} pts` : `${tier.min_score}+ pts`}
                      </span>
                    </div>

                    <h4 style={{ margin: "0.2rem 0 0.1rem", fontSize: "1.05rem" }}>{tier.name}</h4>
                    <span className="muted" style={{ fontSize: "0.85rem", fontStyle: "italic", display: "block", marginBottom: "0.8rem" }}>
                      "{tier.title}"
                    </span>

                    <ul style={{ paddingLeft: "1.2rem", margin: 0, fontSize: "0.85rem", lineHeight: 1.5, color: "var(--color-text-muted)" }}>
                      {tier.perks.map((p, idx) => (
                        <li key={idx} style={{ marginBottom: "0.3rem" }}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--color-border)" }}>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      Points gained via: Place mapping, attribute confirmations, and badge unlocks.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
