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
    <main className="container" style={{ padding: "2.5rem 1.25rem 4rem" }}>
      {/* ── Hero Presentation ── */}
      <section style={{ maxWidth: 720, marginBottom: "1.75rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.35rem 0.85rem",
            background: "var(--color-primary-light)",
            border: "1px solid var(--color-primary-border)",
            borderRadius: "var(--radius-full)",
            marginBottom: "1rem",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--color-primary)",
              display: "inline-block",
              boxShadow: "0 0 8px rgba(15,118,110,0.6)",
            }}
          />
          <span
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "var(--color-primary-dark)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Real-time Accessibility Intelligence
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(2rem, 4vw, 2.85rem)",
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: "0.85rem",
            letterSpacing: "-0.035em",
          }}
        >
          Know before you go.{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Navigate with ease.
          </span>
        </h1>

        <p
          style={{
            fontSize: "1.08rem",
            color: "var(--color-text-secondary)",
            lineHeight: 1.6,
            maxWidth: 640,
            marginBottom: "1.25rem",
          }}
        >
          Search any building or address, or click directly on the map to explore and tag accessibility
          infrastructure — ramps, elevators, tactile paths, and accessible washrooms — verified by the community.
        </p>

        {/* Feature trait indicators */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {[
            { icon: "♿", label: "Wheelchair Entrances" },
            { icon: "🛗", label: "Elevators & Lifts" },
            { icon: "🦯", label: "Tactile Paths" },
            { icon: "🚻", label: "Accessible Restrooms" },
            { icon: "🅿️", label: "Reserved Parking" },
          ].map((f) => (
            <span
              key={f.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                background: "#FFFFFF",
                border: "1.5px solid var(--color-border)",
                padding: "0.28em 0.75em",
                borderRadius: "var(--radius-full)",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <span aria-hidden="true">{f.icon}</span>
              <span>{f.label}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Search Bar ── */}
      <form
        onSubmit={handleSearch}
        style={{
          display: "flex",
          gap: "0.6rem",
          marginBottom: searchResults.length > 1 ? "0.6rem" : "1.25rem",
          maxWidth: 680,
          background: "#FFFFFF",
          padding: "6px",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-sm)",
          border: "1.5px solid var(--color-border)",
        }}
      >
        <label htmlFor="location-search" className="sr-only">
          Search for a place or address
        </label>
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <span
            style={{
              position: "absolute",
              left: "0.85rem",
              color: "var(--color-text-light)",
              fontSize: "1.05rem",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            id="location-search"
            placeholder="Search for a place, building, or address…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              paddingLeft: "2.4rem",
              border: "none",
              boxShadow: "none",
              background: "transparent",
              fontSize: "0.98rem",
            }}
          />
        </div>
        <button
          className="btn-primary"
          type="submit"
          disabled={searching}
          style={{ whiteSpace: "nowrap", padding: "0.6em 1.4em", borderRadius: "var(--radius)" }}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {/* ── Search Results Dropdown ── */}
      {searchResults.length > 1 && (
        <div
          className="card"
          style={{
            padding: "0.5rem",
            marginBottom: "1.25rem",
            maxWidth: 680,
            background: "#FFFFFF",
            border: "1.5px solid var(--color-border-hover)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-text-muted)",
              margin: "0.4rem 0.6rem 0.35rem",
            }}
          >
            Suggested Locations
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {searchResults.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  className="btn-link"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.55rem 0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.9rem",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-text)",
                  }}
                  onClick={() => selectSearchResult(r)}
                >
                  <span style={{ color: "var(--color-primary)" }}>📍</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.display_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Map Container ── */}
      <section
        aria-label="Map of nearby accessible places"
        style={{
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          border: "1.5px solid var(--color-border)",
          boxShadow: "var(--shadow-md)",
          background: "#FFFFFF",
        }}
      >
        <div
          style={{
            padding: "0.75rem 1.15rem",
            background: "#FFFFFF",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🗺️</span>
            <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--color-text)" }}>
              Interactive Community Map
            </span>
          </div>
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--color-primary-dark)",
              background: "var(--color-primary-light)",
              padding: "0.2em 0.65em",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--color-primary-border)",
            }}
          >
            {places.length} places mapped
          </span>
        </div>

        {loading ? (
          <div
            style={{
              height: 480,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#F8FAFC",
              color: "var(--color-text-muted)",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>⏳</span>
            <span>Loading accessibility map…</span>
          </div>
        ) : (
          <PlacesMap
            places={places.filter((p) => p.primary_location)}
            onMapClick={handleMapClick}
            candidatePosition={candidatePosition}
            flyToCenter={flyToCenter}
          />
        )}
      </section>

      {/* ── Candidate Position Pin Card ── */}
      {candidatePosition && (
        <div
          className="card"
          style={{
            marginTop: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            border: "2px solid var(--color-primary)",
            background: "linear-gradient(180deg, #FFFFFF 0%, #F0FDFA 100%)",
            boxShadow: "var(--shadow-md)",
            animation: "toast-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: "var(--color-primary-light)",
                border: "1px solid var(--color-primary-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                flexShrink: 0,
              }}
            >
              📍
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <strong style={{ fontSize: "0.98rem", color: "var(--color-text)" }}>Pin Selected on Map</strong>
                <span
                  style={{
                    background: "var(--color-primary)",
                    color: "#FFFFFF",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "0.1em 0.5em",
                    borderRadius: "999px",
                  }}
                >
                  Ready to tag
                </span>
              </div>
              <p className="muted" style={{ margin: "0.15rem 0 0", fontSize: "0.85rem" }}>
                Coordinates: {candidatePosition.lat.toFixed(5)}, {candidatePosition.lng.toFixed(5)}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn-secondary" onClick={() => setCandidatePosition(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleAddThisPlace}>
              <span>➕</span> Add This Place
            </button>
          </div>
        </div>
      )}

      {!candidatePosition && (
        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 0.9rem",
            background: "#FFFFFF",
            border: "1px dashed var(--color-border)",
            borderRadius: "var(--radius)",
            color: "var(--color-text-muted)",
            fontSize: "0.88rem",
          }}
        >
          <span style={{ fontSize: "1.05rem" }}>💡</span>
          <span>
            <strong>Pro Tip:</strong> Click anywhere on the map to drop a pin and start tagging accessibility
            infrastructure for any venue!
          </span>
        </div>
      )}
    </main>
  );
}
