import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlacesAPI, GeocodeAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ConfidenceBadge from "../components/ConfidenceBadge";
import PlacesMap from "../components/PlacesMap";
import BookmarkButton from "../components/BookmarkButton";

const PAGE_SIZE = 12;

export default function PlacesList() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  // Interactive map & candidate pin state for adding places directly from Explore
  const [candidatePosition, setCandidatePosition] = useState(null);
  const [flyToCenter, setFlyToCenter] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState([]);

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

  function handleMapClick(latlng) {
    setCandidatePosition({ lat: latlng.lat, lng: latlng.lng });
  }

  function handleAddCandidatePlace() {
    if (!user) {
      navigate("/login");
      return;
    }
    navigate("/places/new", {
      state: {
        lat: candidatePosition.lat,
        lng: candidatePosition.lng,
        name: candidatePosition.displayName?.split(",")[0] || (searchInput.trim() || undefined),
        address: candidatePosition.displayName || undefined,
      },
    });
  }

  function handleQuickAddPlace() {
    if (!user) {
      navigate("/login");
      return;
    }
    navigate("/places/new", {
      state: searchInput.trim() ? { name: searchInput.trim() } : undefined,
    });
  }

  async function handleLocateOnMap(e) {
    if (e) e.preventDefault();
    if (!searchInput.trim()) return;
    setGeocoding(true);
    setGeocodeResults([]);
    try {
      const { data } = await GeocodeAPI.search(searchInput.trim());
      setGeocodeResults(data || []);
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setFlyToCenter([lat, lng]);
        setCandidatePosition({
          lat,
          lng,
          displayName: data[0].display_name,
        });
        if (viewMode !== "map") {
          setViewMode("map");
        }
      }
    } catch {
      // geocode search failed
    } finally {
      setGeocoding(false);
    }
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
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", gap: "0.25rem", background: "#E2E8F0", padding: "4px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
              style={{
                fontSize: "0.85rem",
                padding: "0.45em 1em",
                borderRadius: "7px",
                border: "none",
                fontWeight: viewMode === "list" ? "700" : "500",
                background: viewMode === "list" ? "#FFFFFF" : "transparent",
                color: viewMode === "list" ? "var(--color-primary-dark)" : "var(--color-text-secondary)",
                boxShadow: viewMode === "list" ? "0 2px 5px rgba(15,23,42,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              ☰ List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              aria-pressed={viewMode === "map"}
              style={{
                fontSize: "0.85rem",
                padding: "0.45em 1em",
                borderRadius: "7px",
                border: "none",
                fontWeight: viewMode === "map" ? "700" : "500",
                background: viewMode === "map" ? "#FFFFFF" : "transparent",
                color: viewMode === "map" ? "var(--color-primary-dark)" : "var(--color-text-secondary)",
                boxShadow: viewMode === "map" ? "0 2px 5px rgba(15,23,42,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              🗺 Interactive Map
            </button>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleQuickAddPlace}
            style={{
              fontSize: "0.85rem",
              padding: "0.45em 1.1em",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "#0F6E56",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(15,110,86,0.2)",
            }}
          >
            <span>➕</span> Add Place
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
              <label htmlFor="search-places" style={{ margin: 0 }}>Search place, address, or landmark</label>
              {viewMode === "map" && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={handleLocateOnMap}
                  disabled={geocoding || !searchInput.trim()}
                  style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--color-primary, #0F6E56)", padding: 0 }}
                >
                  {geocoding ? "Searching…" : "📍 Locate on Map"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <input
                id="search-places"
                type="search"
                placeholder="e.g. Central Library, Lulu Mall…"
                value={searchInput}
                onChange={handleSearchInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && viewMode === "map" && searchInput.trim()) {
                    e.preventDefault();
                    handleLocateOnMap();
                  }
                }}
              />
              {viewMode === "map" && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleLocateOnMap}
                  disabled={geocoding || !searchInput.trim()}
                  title="Search coordinates & fly map"
                  style={{ fontSize: "0.82rem", padding: "0.4em 0.8em", whiteSpace: "nowrap" }}
                >
                  {geocoding ? "…" : "Locate"}
                </button>
              )}
            </div>

            {/* Geocode matches suggestion list */}
            {viewMode === "map" && geocodeResults.length > 1 && (
              <div
                style={{
                  marginTop: "0.45rem",
                  padding: "0.45rem 0.65rem",
                  background: "#f8fafc",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                }}
              >
                <span className="muted" style={{ fontWeight: 600, display: "block", marginBottom: "0.2rem" }}>
                  Multiple locations found — click one to drop pin:
                </span>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.3rem" }}>
                  {geocodeResults.map((r) => (
                    <li key={r.place_id}>
                      <button
                        type="button"
                        className="btn-link"
                        style={{ textAlign: "left", fontSize: "0.8rem", width: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        onClick={() => {
                          const lat = parseFloat(r.lat);
                          const lng = parseFloat(r.lon);
                          setFlyToCenter([lat, lng]);
                          setCandidatePosition({ lat, lng, displayName: r.display_name });
                        }}
                      >
                        📍 {r.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
              padding: "0.3em 0.8em",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 600,
              border: "1.5px solid",
              borderColor: hasEntrance ? "var(--color-primary)" : "var(--color-border)",
              background: hasEntrance ? "var(--color-primary-light)" : "#ffffff",
              color: hasEntrance ? "var(--color-primary-dark)" : "var(--color-text-secondary)",
              boxShadow: hasEntrance ? "0 1px 4px rgba(15,118,110,0.18)" : "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {hasEntrance ? "✓ " : ""}♿ Accessible Entrance
          </button>

          <button
            type="button"
            onClick={() => setHasRestroom(!hasRestroom)}
            style={{
              padding: "0.3em 0.8em",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 600,
              border: "1.5px solid",
              borderColor: hasRestroom ? "var(--color-primary)" : "var(--color-border)",
              background: hasRestroom ? "var(--color-primary-light)" : "#ffffff",
              color: hasRestroom ? "var(--color-primary-dark)" : "var(--color-text-secondary)",
              boxShadow: hasRestroom ? "0 1px 4px rgba(15,118,110,0.18)" : "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {hasRestroom ? "✓ " : ""}🚻 Accessible Restroom
          </button>

          <button
            type="button"
            onClick={() => setHasElevator(!hasElevator)}
            style={{
              padding: "0.3em 0.8em",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 600,
              border: "1.5px solid",
              borderColor: hasElevator ? "var(--color-primary)" : "var(--color-border)",
              background: hasElevator ? "var(--color-primary-light)" : "#ffffff",
              color: hasElevator ? "var(--color-primary-dark)" : "var(--color-text-secondary)",
              boxShadow: hasElevator ? "0 1px 4px rgba(15,118,110,0.18)" : "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {hasElevator ? "✓ " : ""}🛗 Elevator
          </button>

          <button
            type="button"
            onClick={() => setHasRamp(!hasRamp)}
            style={{
              padding: "0.3em 0.8em",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 600,
              border: "1.5px solid",
              borderColor: hasRamp ? "var(--color-primary)" : "var(--color-border)",
              background: hasRamp ? "var(--color-primary-light)" : "#ffffff",
              color: hasRamp ? "var(--color-primary-dark)" : "var(--color-text-secondary)",
              boxShadow: hasRamp ? "0 1px 4px rgba(15,118,110,0.18)" : "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {hasRamp ? "✓ " : ""}📐 Ramp
          </button>

          <button
            type="button"
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            style={{
              padding: "0.3em 0.8em",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 600,
              border: "1.5px solid",
              borderColor: verifiedOnly ? "var(--color-primary)" : "var(--color-border)",
              background: verifiedOnly ? "var(--color-primary-light)" : "#ffffff",
              color: verifiedOnly ? "var(--color-primary-dark)" : "var(--color-text-secondary)",
              boxShadow: verifiedOnly ? "0 1px 4px rgba(15,118,110,0.18)" : "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
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
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--color-border)", minHeight: 480 }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 480, color: "var(--color-text-muted)" }}>
                Loading map…
              </div>
            ) : (
              <PlacesMap
                places={places.filter((p) => p.primary_location)}
                onMapClick={handleMapClick}
                candidatePosition={candidatePosition}
                flyToCenter={flyToCenter}
                height="500px"
              />
            )}
          </div>

          {/* Candidate Pin Dropped Card */}
          {candidatePosition && (
            <div
              className="card"
              style={{
                marginTop: "0.85rem",
                padding: "1rem 1.25rem",
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                borderRadius: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                boxShadow: "0 4px 12px rgba(15, 110, 86, 0.12)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.6rem" }}>📍</span>
                <div>
                  <strong style={{ color: "#14532d", fontSize: "0.95rem" }}>
                    Selected Location on Map
                  </strong>
                  <p style={{ margin: "0.15rem 0 0", color: "#166534", fontSize: "0.85rem" }}>
                    {candidatePosition.displayName ? (
                      <span style={{ fontWeight: 600 }}>{candidatePosition.displayName}<br /></span>
                    ) : null}
                    Coordinates: {candidatePosition.lat.toFixed(5)}, {candidatePosition.lng.toFixed(5)}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCandidatePosition(null)}
                  style={{ fontSize: "0.85rem", padding: "0.45em 0.9em" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAddCandidatePlace}
                  style={{
                    fontSize: "0.85rem",
                    padding: "0.45em 1.1em",
                    background: "#0F6E56",
                    color: "#fff",
                    fontWeight: 700,
                    boxShadow: "0 2px 4px rgba(15,110,86,0.25)",
                  }}
                >
                  ➕ Add Place at this Location
                </button>
              </div>
            </div>
          )}

          {!candidatePosition && (
            <div
              style={{
                marginTop: "0.65rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
                fontSize: "0.88rem",
                color: "var(--color-text-muted)",
                padding: "0.2rem 0.4rem",
              }}
            >
              <span>
                💡 <strong>Tip:</strong> Click anywhere on the map to drop a pin and start tagging that venue.
              </span>
              <button
                type="button"
                className="btn-link"
                onClick={handleQuickAddPlace}
                style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--color-primary, #0F6E56)" }}
              >
                Or enter details manually →
              </button>
            </div>
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
                {searchInput
                  ? `No places found matching "${searchInput}".`
                  : "No places matched your criteria."}
              </p>
              <p className="muted" style={{ fontSize: "0.9rem", marginTop: "0.4rem" }}>
                Be the first to map this venue and help make the community accessible!
              </p>
              <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                {hasActiveFilters && (
                  <button className="btn-secondary" onClick={resetFilters}>
                    Clear filters
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleQuickAddPlace}
                  style={{ background: "#0F6E56", color: "#fff" }}
                >
                  ➕ Add {searchInput.trim() ? `"${searchInput.trim()}"` : "a new place"}
                </button>
              </div>
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

          {places.length > 0 && (
            <div
              style={{
                marginTop: "2.5rem",
                padding: "1.25rem 1.5rem",
                background: "#f8fafc",
                border: "1px dashed var(--color-border)",
                borderRadius: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.95rem" }}>Know an accessible venue not listed here?</strong>
                <p className="muted" style={{ margin: "0.15rem 0 0", fontSize: "0.85rem" }}>
                  Help fellow community members with mobility needs by mapping it on RAMP.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleQuickAddPlace}
                style={{
                  fontSize: "0.85rem",
                  padding: "0.45em 1.1em",
                  background: "#0F6E56",
                  color: "#fff",
                  fontWeight: 600,
                  boxShadow: "0 2px 4px rgba(15,110,86,0.15)",
                }}
              >
                ➕ Add Venue
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
