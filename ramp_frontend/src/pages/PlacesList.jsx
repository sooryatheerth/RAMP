import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlacesAPI } from "../api/client";
import ConfidenceBadge from "../components/ConfidenceBadge";

export default function PlacesList() {
  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    PlacesAPI.categories().then((res) => setCategories(res.data.results || res.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = categoryFilter ? { category: categoryFilter } : {};
    PlacesAPI.list(params)
      .then((res) => setPlaces(res.data.results || res.data))
      .finally(() => setLoading(false));
  }, [categoryFilter]);

  return (
    <main className="container" style={{ padding: "2rem 1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <h1>Explore places</h1>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label htmlFor="category-filter">Filter by category</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading places…</p>
      ) : places.length === 0 ? (
        <p className="muted">No places found. Be the first to add one.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
          {places.map((place) => (
            <li key={place.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <div>
                  <h3 style={{ marginBottom: "0.2em" }}>
                    <Link to={`/places/${place.id}`}>{place.name}</Link>
                  </h3>
                  <p className="muted" style={{ margin: 0 }}>{place.category_name} · {place.city}</p>
                </div>
                <ConfidenceBadge score={place.overall_accessibility_score} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
