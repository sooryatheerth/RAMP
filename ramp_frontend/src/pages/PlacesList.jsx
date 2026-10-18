import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { PlacesAPI } from "../api/client";
import ConfidenceBadge from "../components/ConfidenceBadge";
import PlacesMap from "../components/PlacesMap";

const PAGE_SIZE = 12;

export default function PlacesList() {
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
  const searchTimer = useRef(null);

  useEffect(() => {
    PlacesAPI.categories().then((res) => setCategories(res.data.results || res.data));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, cityFilter, search]);

  useEffect(() => {
    setLoading(true);
    const params = {
      page,
      page_size: PAGE_SIZE,
    };
    if (categoryFilter) params.category = categoryFilter;
    if (cityFilter) params.city = cityFilter;
    if (search) params.q = search;

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
  }, [categoryFilter, cityFilter, search, page]);

  function handleSearchInput(e) {
    setSearchInput(e.target.value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(e.target.value), 400);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Collect unique cities from loaded results for the city dropdown
  const knownCities = [...new Set(places.map((p) => p.city).filter(Boolean))].sort();

  return (
    <main className="container" style={{ padding: "2rem 1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0 }}>Explore places</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className={viewMode === "list" ? "btn-primary" : "btn-secondary"}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            style={{ fontSize: "0.85rem", padding: "0.4em 0.85em" }}
          >
            ☰ List
          </button>
          <button
            className={viewMode === "map" ? "btn-primary" : "btn-secondary"}
            onClick={() => setViewMode("map")}
            aria-pressed={viewMode === "map"}
            style={{ fontSize: "0.85rem", padding: "0.4em 0.85em" }}
          >
            🗺 Map
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.75rem", marginBottom: "1.25rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="search-places">Search by name or address</label>
          <input
            id="search-places"
            type="search"
            placeholder="e.g. Central Library…"
            value={searchInput}
            onChange={handleSearchInput}
          />
        </div>
        <div className="field" style={{ margin: 0, minWidth: 160 }}>
          <label htmlFor="category-filter">Category</label>
          <select id="category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 140 }}>
          <label htmlFor="city-filter">City</label>
          <select id="city-filter" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">All cities</option>
            {knownCities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </div>
      </div>

      {/* Map view */}
      {viewMode === "map" && (
        <div style={{ marginBottom: "1.5rem", borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-border)", height: 460 }}>
          {loading ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted)" }}>Loading map…</div>
            : <PlacesMap places={places} />}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <>
          {loading ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card skeleton" style={{ height: 72, borderRadius: 10 }} />
              ))}
            </div>
          ) : places.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <p className="muted" style={{ fontSize: "1.1rem" }}>No places found.</p>
              <Link to="/places/new"><button className="btn-primary" style={{ marginTop: "0.75rem" }}>Be the first to add one</button></Link>
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
              {places.map((place) => (
                <li key={place.id} className="card" style={{ padding: "1rem 1.2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div>
                      <h3 style={{ marginBottom: "0.15em" }}>
                        <Link to={`/places/${place.id}`} style={{ textDecoration: "none", color: "var(--color-text)" }}>
                          {place.name}
                        </Link>
                      </h3>
                      <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                        {place.category_name}
                        {place.city ? ` · ${place.city}` : ""}
                        {place.address ? ` · ${place.address}` : ""}
                      </p>
                    </div>
                    <ConfidenceBadge score={place.overall_accessibility_score} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "1.5rem" }}>
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: "0.4em 0.85em" }}
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
                style={{ padding: "0.4em 0.85em" }}
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
