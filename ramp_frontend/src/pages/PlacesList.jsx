import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { PlacesAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ConfidenceBadge from "../components/ConfidenceBadge";
import PlacesMap from "../components/PlacesMap";
import BookmarkButton from "../components/BookmarkButton";

const PAGE_SIZE = 12;

export default function PlacesList() {
  const { user } = useAuth();
  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"

  // Advanced accessibility filters
  const [minScore, setMinScore] = useState("");
  const [hasEntrance, setHasEntrance] = useState(false);
  const [hasRestroom, setHasRestroom] = useState(false);
  const [hasElevator, setHasElevator] = useState(false);
  const [hasRamp, setHasRamp] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("score_desc");
  const [matchMyProfile, setMatchMyProfile] = useState(false);

  const searchTimer = useRef(null);

  const userProfiles = user?.accessibility_profiles || [];
  const hasUserProfiles = userProfiles.length > 0;

  useEffect(() => {
    PlacesAPI.categories().then((res) => setCategories(res.data.results || res.data));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    categoryFilter, cityFilter, search, minScore,
    hasEntrance, hasRestroom, hasElevator, hasRamp, verifiedOnly, sortBy, matchMyProfile
  ]);

  useEffect(() => {
    setLoading(true);
    const params = {
      page,
      page_size: PAGE_SIZE,
      sort_by: sortBy,
    };
    if (categoryFilter) params.category = categoryFilter;
    if (cityFilter) params.city = cityFilter;
    if (search) params.q = search;
    if (minScore) params.min_score = minScore;
    if (hasEntrance || (matchMyProfile && isWheelchairUser)) params.has_accessible_entrance = "true";
    if (hasRestroom) params.has_accessible_restroom = "true";
    if (hasElevator) params.has_elevator = "true";
    if (hasRamp) params.has_ramp = "true";
    if (verifiedOnly) params.verified_only = "true";

    PlacesAPI.list(params)
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data)) {
          setPlaces(data);
          setTotal(data.length);
        } else {
          setPlaces(data.results || []);
          setTotal(data.count || 0);
        }
      })
      .finally(() => setLoading(false));
  }, [
    categoryFilter, cityFilter, search, minScore,
    hasEntrance, hasRestroom, hasElevator, hasRamp, verifiedOnly, sortBy, matchMyProfile, page
  ]);

  function handleSearchInput(e) {
    setSearchInput(e.target.value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(e.target.value), 400);
  }

  const isWheelchairUser = userProfiles.some(
    (p) => p.code?.includes("wheelchair") || p.label?.toLowerCase().includes("wheelchair")
  );

  function resetFilters() {
    setCategoryFilter("");
    setCityFilter("");
    setSearch("");
    setSearchInput("");
    setMinScore("");
    setHasEntrance(false);
    setHasRestroom(false);
    setHasElevator(false);
    setHasRamp(false);
    setVerifiedOnly(false);
    setSortBy("score_desc");
    setMatchMyProfile(false);
  }

  const hasActiveFilters = Boolean(
    categoryFilter || cityFilter || search || minScore ||
    hasEntrance || hasRestroom || hasElevator || hasRamp || verifiedOnly || matchMyProfile || sortBy !== "score_desc"
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const knownCities = [...new Set(places.map((p) => p.city).filter(Boolean))].sort();

  return (
    <main className="container" style={{ padding: "2rem 1.25rem 4rem" }}>
      {/* ── Header & View Mode Switch ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Explore Accessible Places</h1>
          <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.92rem" }}>
            Find community-mapped venues with verified accessible entrances, restrooms, and amenities
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className={viewMode === "list" ? "btn-primary" : "btn-secondary"}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            style={{ fontSize: "0.85rem", padding: "0.45em 0.9em" }}
          >
            ☰ List View
          </button>
          <button
            className={viewMode === "map" ? "btn-primary" : "btn-secondary"}
            onClick={() => setViewMode("map")}
            aria-pressed={viewMode === "map"}
            style={{ fontSize: "0.85rem", padding: "0.45em 0.9em" }}
          >
            🗺 Interactive Map
          </button>
        </div>
      </div>

      {/* ── Search & Core Filters Bar ── */}
      <div
        className="card"
        style={{
          padding: "1.2rem",
          marginBottom: "1.25rem",
          background: "#ffffff",
          borderRadius: 14,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: "0.75rem", alignItems: "flex-end" }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="search-places">Search place, address, or landmark</label>
            <input
              id="search-places"
              type="search"
              placeholder="e.g. Central Library, Lulu Mall…"
              value={searchInput}
              onChange={handleSearchInput}
            />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="category-filter">Category</label>
            <select id="category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="city-filter">City</label>
            <select id="city-filter" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">All Cities</option>
              {knownCities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="sort-filter">Sort by</label>
            <select id="sort-filter" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="score_desc">Highest Score</option>
              <option value="newest">Recently Added</option>
              <option value="name">Alphabetical (A-Z)</option>
              <option value="score_asc">Needs Mapping / Lower Score</option>
            </select>
          </div>
        </div>

        {/* ── Accessibility Traits & Score Filter Pills ── */}
        <div style={{ marginTop: "1rem", paddingTop: "0.9rem", borderTop: "1px solid var(--color-border)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
          <span className="muted" style={{ fontSize: "0.82rem", fontWeight: 700, marginRight: "0.2rem" }}>
            Accessibility Traits:
          </span>

          {/* Personalized match toggle if user has configured profile */}
          {hasUserProfiles && (
            <button
              type="button"
              onClick={() => setMatchMyProfile(!matchMyProfile)}
              style={{
                padding: "0.3em 0.8em",
                borderRadius: 999,
                fontSize: "0.82rem",
                fontWeight: 700,
                border: "1.5px solid",
                borderColor: matchMyProfile ? "var(--color-primary)" : "var(--color-border)",
                background: matchMyProfile ? "var(--color-primary-light)" : "#ffffff",
                color: matchMyProfile ? "var(--color-primary-dark)" : "var(--color-text)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <span>🎯</span>
              <span>Match My Profile ({userProfiles.map((p) => p.label).join(", ")})</span>
            </button>
          )}

          {/* Quick Score filters */}
          {[
            { label: "50%+ Basic Access", val: "50" },
            { label: "70%+ Highly Accessible", val: "70" },
            { label: "85%+ Certified", val: "85" },
          ].map(({ label, val }) => (
            <button
              key={val}
              type="button"
              onClick={() => setMinScore(minScore === val ? "" : val)}
              style={{
                padding: "0.25em 0.7em",
                borderRadius: 999,
                fontSize: "0.8rem",
                fontWeight: 600,
                border: "1px solid",
                borderColor: minScore === val ? "var(--color-primary)" : "var(--color-border)",
                background: minScore === val ? "var(--color-primary-light)" : "#ffffff",
                color: minScore === val ? "var(--color-primary-dark)" : "var(--color-text-muted)",
                cursor: "pointer",
              }}
            >
              {minScore === val ? "✓ " : ""}{label}
            </button>
          ))}

          {/* Amenity toggles */}
          <button
            type="button"
            onClick={() => setHasEntrance(!hasEntrance)}
            style={{
              padding: "0.25em 0.7em",
              borderRadius: 999,
              fontSize: "0.8rem",
              fontWeight: 600,
              border: "1px solid",
              borderColor: hasEntrance ? "var(--color-primary)" : "var(--color-border)",
              background: hasEntrance ? "var(--color-primary-light)" : "#ffffff",
              color: hasEntrance ? "var(--color-primary-dark)" : "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            {hasEntrance ? "✓ " : ""}♿ Accessible Entrance
          </button>

          <button
            type="button"
            onClick={() => setHasRestroom(!hasRestroom)}
            style={{
              padding: "0.25em 0.7em",
              borderRadius: 999,
              fontSize: "0.8rem",
              fontWeight: 600,
              border: "1px solid",
              borderColor: hasRestroom ? "var(--color-primary)" : "var(--color-border)",
              background: hasRestroom ? "var(--color-primary-light)" : "#ffffff",
              color: hasRestroom ? "var(--color-primary-dark)" : "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            {hasRestroom ? "✓ " : ""}🚻 Accessible Restroom
          </button>

          <button
            type="button"
            onClick={() => setHasElevator(!hasElevator)}
            style={{
              padding: "0.25em 0.7em",
              borderRadius: 999,
              fontSize: "0.8rem",
              fontWeight: 600,
              border: "1px solid",
              borderColor: hasElevator ? "var(--color-primary)" : "var(--color-border)",
              background: hasElevator ? "var(--color-primary-light)" : "#ffffff",
              color: hasElevator ? "var(--color-primary-dark)" : "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            {hasElevator ? "✓ " : ""}🛗 Elevator
          </button>

          <button
            type="button"
            onClick={() => setHasRamp(!hasRamp)}
            style={{
              padding: "0.25em 0.7em",
              borderRadius: 999,
              fontSize: "0.8rem",
              fontWeight: 600,
              border: "1px solid",
              borderColor: hasRamp ? "var(--color-primary)" : "var(--color-border)",
              background: hasRamp ? "var(--color-primary-light)" : "#ffffff",
              color: hasRamp ? "var(--color-primary-dark)" : "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            {hasRamp ? "✓ " : ""}📐 Ramp
          </button>

          <button
            type="button"
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            style={{
              padding: "0.25em 0.7em",
              borderRadius: 999,
              fontSize: "0.8rem",
              fontWeight: 600,
              border: "1px solid",
              borderColor: verifiedOnly ? "var(--color-primary)" : "var(--color-border)",
              background: verifiedOnly ? "var(--color-primary-light)" : "#ffffff",
              color: verifiedOnly ? "var(--color-primary-dark)" : "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            {verifiedOnly ? "✓ " : ""}🏅 Peer-Verified Only
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="btn-link"
              style={{ fontSize: "0.8rem", color: "var(--color-danger)", marginLeft: "auto" }}
            >
              Reset all filters ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Map View ── */}
      {viewMode === "map" && (
        <div style={{ marginBottom: "1.5rem", borderRadius: 14, overflow: "hidden", border: "1px solid var(--color-border)", height: 480 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted)" }}>
              Loading map…
            </div>
          ) : (
            <PlacesMap places={places} />
          )}
        </div>
      )}

      {/* ── List View ── */}
      {viewMode === "list" && (
        <>
          {loading ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card skeleton" style={{ height: 80, borderRadius: 12 }} />
              ))}
            </div>
          ) : places.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3.5rem 1rem" }}>
              <p className="muted" style={{ fontSize: "1.1rem", margin: 0 }}>
                No places matched your criteria.
              </p>
              {hasActiveFilters && (
                <button className="btn-secondary" onClick={resetFilters} style={{ marginTop: "1rem" }}>
                  Clear filters
                </button>
              )}
              <Link to="/places/new">
                <button className="btn-primary" style={{ marginTop: "1rem", marginLeft: "0.5rem" }}>
                  + Add a new place
                </button>
              </Link>
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.85rem" }}>
              {places.map((place) => {
                // Personal match check
                let matchLabel = null;
                if (hasUserProfiles && isWheelchairUser) {
                  if (place.has_accessible_entrance || place.has_ramp) {
                    matchLabel = "✓ Wheelchair Step-Free";
                  } else {
                    matchLabel = "⚠ Check Entrance";
                  }
                }

                return (
                  <li key={place.id} className="card" style={{ padding: "1.15rem 1.3rem", borderRadius: 12, transition: "box-shadow 0.2s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                          <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                            {place.category_name}
                          </span>
                          {place.average_rating ? (
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "0.1em 0.5em", borderRadius: 999 }}>
                              ★ {place.average_rating} ({place.reviews_count})
                            </span>
                          ) : null}
                          {matchLabel && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                padding: "0.1em 0.55em",
                                borderRadius: 999,
                                background: matchLabel.startsWith("✓") ? "var(--color-primary-light)" : "var(--color-warn-light)",
                                color: matchLabel.startsWith("✓") ? "var(--color-primary-dark)" : "var(--color-warn)",
                              }}
                            >
                              {matchLabel}
                            </span>
                          )}
                        </div>

                        <h3 style={{ margin: "0.1rem 0 0.3rem" }}>
                          <Link to={`/places/${place.id}`} style={{ textDecoration: "none", color: "var(--color-text)" }}>
                            {place.name}
                          </Link>
                        </h3>

                        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                          {place.city ? `${place.city}` : ""}
                          {place.address ? ` · ${place.address}` : ""}
                        </p>

                        {/* Trait indicators */}
                        <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
                          {place.has_accessible_entrance && (
                            <span style={{ fontSize: "0.75rem", padding: "0.1em 0.45em", borderRadius: 6, background: "#f1f5f9", color: "#334155" }}>
                              ♿ Step-free
                            </span>
                          )}
                          {place.has_accessible_restroom && (
                            <span style={{ fontSize: "0.75rem", padding: "0.1em 0.45em", borderRadius: 6, background: "#f1f5f9", color: "#334155" }}>
                              🚻 Restroom
                            </span>
                          )}
                          {place.has_elevator && (
                            <span style={{ fontSize: "0.75rem", padding: "0.1em 0.45em", borderRadius: 6, background: "#f1f5f9", color: "#334155" }}>
                              🛗 Elevator
                            </span>
                          )}
                          {place.has_ramp && (
                            <span style={{ fontSize: "0.75rem", padding: "0.1em 0.45em", borderRadius: 6, background: "#f1f5f9", color: "#334155" }}>
                              📐 Ramp
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right action block */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
                        <BookmarkButton placeId={place.id} initialSaved={place.is_saved} size="sm" />
                        <ConfidenceBadge score={place.overall_accessibility_score} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", marginTop: "2rem" }}>
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: "0.4em 0.9em" }}
              >
                ← Prev
              </button>
              <span className="muted" style={{ fontSize: "0.9rem" }}>
                Page {page} of {totalPages} ({total} places)
              </span>
              <button
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: "0.4em 0.9em" }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
