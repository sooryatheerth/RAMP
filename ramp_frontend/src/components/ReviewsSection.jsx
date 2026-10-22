import { useEffect, useState } from "react";
import { ReviewsAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import RewardTierBadge from "./RewardTierBadge";

const SUGGESTED_TAGS = [
  "Smooth ramp",
  "Spacious restroom",
  "Elevator available",
  "Braille signage",
  "Tactile guidance",
  "Step-free access",
  "Wide aisles",
  "Quiet / low sensory",
  "Heavy door",
  "Steep incline",
  "Accessible parking",
  "Helpful staff",
];

export default function ReviewsSection({ placeId, placeName }) {
  const { user, refreshUser } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileFilter, setProfileFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  // Review form state
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [selectedProfile, setSelectedProfile] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [visitDate, setVisitDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function loadReviews() {
    setLoading(true);
    const params = {};
    if (profileFilter) params.profile = profileFilter;
    if (tagFilter) params.tag = tagFilter;

    Promise.all([
      ReviewsAPI.list(placeId, params),
      ReviewsAPI.stats(placeId),
    ])
      .then(([revRes, statsRes]) => {
        setReviews(revRes.data.results || revRes.data);
        setStats(statsRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReviews();
  }, [placeId, profileFilter, tagFilter]);

  function toggleTag(tag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (!reviewText.trim()) {
      setFormError("Please enter your review experience.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setSuccessMsg("");

    try {
      const payload = {
        rating,
        title: title.trim(),
        review_text: reviewText.trim(),
        tags: selectedTags,
      };
      if (selectedProfile) payload.accessibility_profile = selectedProfile;
      if (visitDate) payload.visit_date = visitDate;

      await ReviewsAPI.create(placeId, payload);
      setSuccessMsg("Thank you! Your accessibility review was published (+5 reputation points).");
      setShowForm(false);
      setTitle("");
      setReviewText("");
      setSelectedTags([]);
      setVisitDate("");
      if (refreshUser) refreshUser();
      loadReviews();
    } catch (err) {
      setFormError(
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        "Could not submit review. You may have already reviewed this place."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVoteHelpful(reviewId) {
    try {
      const { data } = await ReviewsAPI.helpful(placeId, reviewId);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, helpful_count: data.helpful_count, has_voted_helpful: data.has_voted_helpful }
            : r
        )
      );
    } catch {
      alert("Please log in to vote on reviews.");
    }
  }

  async function handleDeleteReview(reviewId) {
    if (!window.confirm("Are you sure you want to delete your review?")) return;
    try {
      await ReviewsAPI.delete(placeId, reviewId);
      loadReviews();
    } catch {
      alert("Could not delete review.");
    }
  }

  return (
    <section style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{ margin: 0 }}>Community Accessibility Reviews</h2>
          <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.9rem" }}>
            Real-world experiences from people with diverse accessibility perspectives
          </p>
        </div>
        {user && !showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            ★ Write a review
          </button>
        )}
      </div>

      {successMsg && (
        <div style={{ marginTop: "1rem", padding: "0.85rem 1rem", borderRadius: 8, background: "var(--color-primary-light)", color: "var(--color-primary-dark)", fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {/* Review Submission Form */}
      {showForm && (
        <div className="card" style={{ marginTop: "1rem", border: "1.5px solid var(--color-primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <h3 style={{ margin: 0 }}>Share your accessibility experience</h3>
            <button
              onClick={() => setShowForm(false)}
              style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--color-text-muted)" }}
            >
              ✕
            </button>
          </div>

          {formError && <p className="error-text" role="alert">{formError}</p>}

          <form onSubmit={handleSubmitReview}>
            {/* Star Rating Picker */}
            <div className="field">
              <label>Overall Accessibility Rating</label>
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "1.8rem",
                      color: star <= (hoverRating || rating) ? "#f59e0b" : "#cbd5e1",
                      padding: "0 0.1rem",
                      transition: "transform 0.1s",
                    }}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                ))}
                <span style={{ marginLeft: "0.5rem", fontWeight: 700, fontSize: "1.1rem", color: "#b45309" }}>
                  {rating} of 5
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="field">
              <label htmlFor="rev-title">Review headline (optional)</label>
              <input
                id="rev-title"
                placeholder="e.g. Excellent automatic ramp, but restrooms are tight"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Quick Experience Tags */}
            <div className="field">
              <label>Highlight features (select all that apply)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.2rem" }}>
                {SUGGESTED_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: "0.3em 0.7em",
                        borderRadius: 999,
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        border: "1px solid",
                        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                        background: active ? "var(--color-primary-light)" : "#ffffff",
                        color: active ? "var(--color-primary-dark)" : "var(--color-text)",
                        cursor: "pointer",
                      }}
                    >
                      {active ? "✓ " : "+ "}{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Experience */}
            <div className="field">
              <label htmlFor="rev-text">
                Your experience details <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <textarea
                id="rev-text"
                required
                rows={3}
                placeholder="Describe how easy or difficult it was to enter, navigate, and use amenities at this place…"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1rem" }}>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Posting review…" : "Submit review (+5 pts)"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Aggregate Rating Banner */}
      {stats && stats.total_reviews > 0 && (
        <div
          className="card"
          style={{
            marginTop: "1rem",
            padding: "1.25rem",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "1.5rem",
            alignItems: "center",
            background: "#fafafa",
          }}
        >
          {/* Average rating score */}
          <div style={{ textAlign: "center", paddingRight: "1rem", borderRight: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: "2.8rem", fontWeight: 800, color: "#b45309", lineHeight: 1 }}>
              {stats.average_rating.toFixed(1)}
            </div>
            <div style={{ color: "#f59e0b", fontSize: "1.2rem", margin: "0.2rem 0" }}>
              {"★".repeat(Math.round(stats.average_rating))}
              {"☆".repeat(5 - Math.round(stats.average_rating))}
            </div>
            <span className="muted" style={{ fontSize: "0.82rem" }}>
              {stats.total_reviews} {stats.total_reviews === 1 ? "review" : "reviews"}
            </span>
          </div>

          {/* Star Distribution */}
          <div style={{ display: "grid", gap: "0.3rem" }}>
            {[5, 4, 3, 2, 1].map((s) => {
              const count = stats.rating_distribution?.[s] || 0;
              const pct = stats.total_reviews ? (count / stats.total_reviews) * 100 : 0;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem" }}>
                  <span style={{ width: 30, color: "var(--color-text-muted)" }}>{s} ★</span>
                  <div style={{ flex: 1, height: 7, background: "var(--color-border)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#f59e0b", borderRadius: 999 }} />
                  </div>
                  <span style={{ width: 25, textAlign: "right", color: "var(--color-text-muted)" }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Popular Tags Filter */}
      {stats?.top_tags?.length > 0 && (
        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>Frequent topics:</span>
          {tagFilter && (
            <button
              className="btn-secondary"
              onClick={() => setTagFilter("")}
              style={{ fontSize: "0.78rem", padding: "0.2em 0.6em", borderRadius: 999 }}
            >
              Clear tag: {tagFilter} ✕
            </button>
          )}
          {stats.top_tags.map(({ tag, count }) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
              style={{
                padding: "0.2em 0.6em",
                borderRadius: 999,
                fontSize: "0.78rem",
                border: "1px solid",
                borderColor: tagFilter === tag ? "var(--color-primary)" : "var(--color-border)",
                background: tagFilter === tag ? "var(--color-primary-light)" : "#ffffff",
                color: tagFilter === tag ? "var(--color-primary-dark)" : "var(--color-text-muted)",
                cursor: "pointer",
              }}
            >
              {tag} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Reviews List */}
      <div style={{ marginTop: "1.2rem" }}>
        {loading ? (
          <p className="muted">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <p className="muted" style={{ margin: 0 }}>
              No reviews yet for this place.
            </p>
            {user && !showForm && (
              <button
                className="btn-primary"
                onClick={() => setShowForm(true)}
                style={{ marginTop: "0.8rem", fontSize: "0.88rem" }}
              >
                Be the first to leave an accessibility review
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.85rem" }}>
            {reviews.map((rev) => (
              <div key={rev.id} className="card" style={{ padding: "1.1rem 1.25rem" }}>
                {/* Review Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color: "#f59e0b", fontSize: "1.1rem" }}>
                        {"★".repeat(rev.rating)}
                        {"☆".repeat(5 - rev.rating)}
                      </span>
                      {rev.title && <strong style={{ fontSize: "1rem" }}>{rev.title}</strong>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                      <span className="muted" style={{ fontSize: "0.82rem" }}>
                        by <strong>{rev.user_username}</strong>
                      </span>
                      {rev.user_tier && (
                        <RewardTierBadge tier={rev.user_tier.tier} title={rev.user_tier.title} size="sm" showTitle={false} />
                      )}
                      {rev.accessibility_profile_label && (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.15em 0.55em",
                            borderRadius: 999,
                            background: "var(--color-primary-light)",
                            color: "var(--color-primary-dark)",
                            fontWeight: 600,
                          }}
                        >
                          {rev.accessibility_profile_label}
                        </span>
                      )}
                      <span className="muted" style={{ fontSize: "0.8rem" }}>
                        · {new Date(rev.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {rev.is_my_review && (
                    <button
                      onClick={() => handleDeleteReview(rev.id)}
                      style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Review Body */}
                <p style={{ margin: "0.7rem 0 0.5rem", fontSize: "0.95rem", lineHeight: 1.5, color: "var(--color-text)" }}>
                  {rev.review_text}
                </p>

                {/* Tags */}
                {rev.tags?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", margin: "0.5rem 0" }}>
                    {rev.tags.map((t, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: "0.76rem",
                          padding: "0.15em 0.55em",
                          borderRadius: 999,
                          background: "#f1f5f9",
                          color: "#334155",
                          fontWeight: 500,
                        }}
                      >
                        ✓ {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Helpful Button */}
                <div style={{ marginTop: "0.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    onClick={() => handleVoteHelpful(rev.id)}
                    style={{
                      background: rev.has_voted_helpful ? "var(--color-primary-light)" : "none",
                      border: "1px solid",
                      borderColor: rev.has_voted_helpful ? "var(--color-primary)" : "var(--color-border)",
                      color: rev.has_voted_helpful ? "var(--color-primary-dark)" : "var(--color-text-muted)",
                      padding: "0.25em 0.65em",
                      borderRadius: 6,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      fontWeight: 600,
                    }}
                  >
                    <span>👍</span> Helpful ({rev.helpful_count || 0})
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
