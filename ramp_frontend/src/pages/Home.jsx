import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlacesAPI, GeocodeAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import PlacesMap from "../components/PlacesMap";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [flyToCenter, setFlyToCenter] = useState(null);
  const [candidatePosition, setCandidatePosition] = useState(null);

  useEffect(() => {
    PlacesAPI.list()
      .then((res) => setPlaces(res.data.results || res.data))
      .finally(() => setLoading(false));
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchText.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const { data } = await GeocodeAPI.search(searchText);
      setSearchResults(data);
      if (data.length > 0) {
        selectSearchResult(data[0]);
      }
    } catch {
      // Geocoding failed - leave results empty, user can still click the map directly
    } finally {
      setSearching(false);
    }
  }

  function selectSearchResult(result) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setFlyToCenter([lat, lng]);
    setCandidatePosition({ lat, lng });
  }

  function handleMapClick(latlng) {
    setCandidatePosition({ lat: latlng.lat, lng: latlng.lng });
  }

  function handleAddThisPlace() {
    if (!user) {
      navigate("/login");
      return;
    }
    navigate("/places/new", { state: { lat: candidatePosition.lat, lng: candidatePosition.lng } });
  }

  return (
    <main className="container" style={{ padding: "2.5rem 1.25rem" }}>
      <section style={{ maxWidth: 640, marginBottom: "1.5rem" }}>
        <p className="muted" style={{ fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", fontSize: "0.8rem" }}>
          Real-time accessibility platform
        </p>
        <h1>Know before you go.</h1>
        <p style={{ fontSize: "1.1rem", color: "var(--color-text-muted)" }}>
          Search a location or click directly on the map to tag its accessibility features —
          ramps, elevators, tactile paths, and accessible washrooms — verified by the community.
        </p>
      </section>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.6rem", marginBottom: "0.8rem", maxWidth: 640 }}>
        <label htmlFor="location-search" className="sr-only">Search for a place or address</label>
        <input
          id="location-search"
          placeholder="Search for a place, building, or address…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {searchResults.length > 1 && (
        <ul style={{ listStyle: "none", padding: 0, marginBottom: "1rem", maxWidth: 640 }}>
          {searchResults.map((r) => (
            <li key={r.place_id}>
              <button
                className="btn-link"
                style={{ textAlign: "left" }}
                onClick={() => selectSearchResult(r)}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Map of nearby accessible places">
        {loading ? (
          <p className="muted">Loading map…</p>
        ) : (
          <PlacesMap
            places={places.filter((p) => p.primary_location)}
            onMapClick={handleMapClick}
            candidatePosition={candidatePosition}
            flyToCenter={flyToCenter}
          />
        )}
      </section>

      {candidatePosition && (
        <div className="card" style={{ marginTop: "1rem", maxWidth: 640, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <strong>Pin dropped</strong>
            <p className="muted" style={{ margin: 0 }}>
              {candidatePosition.lat.toFixed(5)}, {candidatePosition.lng.toFixed(5)}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn-secondary" onClick={() => setCandidatePosition(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleAddThisPlace}>Add this place</button>
          </div>
        </div>
      )}

      {!candidatePosition && (
        <p className="muted" style={{ marginTop: "0.8rem", fontSize: "0.9rem" }}>
          Tip: click anywhere on the map to drop a pin and start tagging that location.
        </p>
      )}
    </main>
  );
}
