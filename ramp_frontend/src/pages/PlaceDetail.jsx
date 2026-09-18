import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PlacesAPI, AccessPointsAPI, FacilitiesAPI, ImagesAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ConfidenceBadge from "../components/ConfidenceBadge";

// ---------------------------------------------------------------------------
// Attribute row with confirm / dispute buttons
// ---------------------------------------------------------------------------
function AttributeRow({ attribute, placeId, accessPointId, onVerified }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const displayValue =
    attribute.value_boolean !== null && attribute.value_boolean !== undefined
      ? (attribute.value_boolean ? "Yes" : "No")
      : attribute.value_number ?? attribute.value_text ?? "—";

  const statusStyles = {
    verified: { background: "var(--color-primary-light)", color: "var(--color-primary-dark)" },
    pending: { background: "var(--color-warn-light)", color: "var(--color-warn)" },
    disputed: { background: "var(--color-danger-light)", color: "var(--color-danger)" },
    rejected: { background: "var(--color-danger-light)", color: "var(--color-danger)" },
  };

  async function handleVerify(action) {
    setBusy(true);
    try {
      await AccessPointsAPI.verifyAttribute(placeId, accessPointId, attribute.id, { action });
      onVerified();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not submit verification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6em 0", borderBottom: "1px solid var(--color-border)" }}>
      <div>
        <strong>{attribute.attribute_name}:</strong> {String(displayValue)}{" "}
        <span
          style={{ ...statusStyles[attribute.verification_status], padding: "0.1em 0.5em", borderRadius: 999, fontSize: "0.78rem", fontWeight: 700, marginLeft: "0.4em" }}
        >
          {attribute.verification_status}
        </span>
      </div>
      {user && (
        <div style={{ display: "flex", gap: "0.4em" }}>
          <button className="btn-secondary" disabled={busy} onClick={() => handleVerify("confirm")}>Confirm</button>
          <button className="btn-secondary" disabled={busy} onClick={() => handleVerify("dispute")}>Dispute</button>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Access point card
// ---------------------------------------------------------------------------
function AccessPointCard({ accessPoint, placeId, onChanged }) {
  const [attributes, setAttributes] = useState([]);
  const [images, setImages] = useState([]);

  function loadAttributes() {
    AccessPointsAPI.attributes(placeId, accessPoint.id).then((res) => setAttributes(res.data.results || res.data));
  }

  useEffect(() => {
    loadAttributes();
    ImagesAPI.list("access_point", accessPoint.id).then((res) => setImages(res.data.results || res.data));
  }, [accessPoint.id]);

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>{accessPoint.label}</h3>
        <span className={`confidence-badge ${accessPoint.is_accessible ? "high" : "low"}`}>
          <span className="dot" aria-hidden="true" />
          {accessPoint.is_accessible ? "Accessible entrance" : "Not marked accessible"}
        </span>
      </div>
      {accessPoint.notes && <p className="muted">{accessPoint.notes}</p>}

      {images.length > 0 && (
        <div style={{ display: "flex", gap: "0.6em", marginBottom: "0.8em", flexWrap: "wrap" }}>
          {images.map((img) => (
            <img
              key={img.id}
              src={ImagesAPI.thumbUrl(img.id)}
              alt={img.alt_text}
              style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid var(--color-border)" }}
            />
          ))}
        </div>
      )}

      {attributes.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {attributes.map((attr) => (
            <AttributeRow
              key={attr.id}
              attribute={attr}
              placeId={placeId}
              accessPointId={accessPoint.id}
              onVerified={loadAttributes}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline "Add a facility" form for logged-in users
// ---------------------------------------------------------------------------

// Seeded facility types (IDs match the standard seed). The form fetches them
// live if available; these are the fallback for offline / first-run.
const FACILITY_TYPE_OPTIONS = [
  { id: 1, name: "Restroom" },
  { id: 2, name: "Elevator" },
  { id: 3, name: "Parking" },
  { id: 4, name: "Ramp" },
  { id: 5, name: "Tactile Path" },
  { id: 6, name: "Braille Signage" },
];

function AddFacilityForm({ placeId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [facility, setFacility] = useState({
    facility_type: "", floor_level: "", location_description: "", is_accessible: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!facility.facility_type) { setError("Please select a facility type."); return; }
    setBusy(true);
    setError("");
    try {
      await FacilitiesAPI.create(placeId, facility);
      setFacility({ facility_type: "", floor_level: "", location_description: "", is_accessible: false });
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save the facility. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        id="add-facility-btn"
        className="btn-secondary"
        style={{ marginTop: "0.5rem" }}
        onClick={() => setOpen(true)}
      >
        + Add a facility
      </button>
    );
  }

  return (
    <div className="card" style={{ marginTop: "1rem", border: "1px solid var(--color-primary)" }}>
      <h3 style={{ marginTop: 0 }}>Add a facility to this building</h3>
      {error && <p className="error-text" role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="new-f-type">Facility type</label>
          <select
            id="new-f-type"
            required
            value={facility.facility_type}
            onChange={(e) => setFacility({ ...facility, facility_type: e.target.value })}
          >
            <option value="">Select a type</option>
            {FACILITY_TYPE_OPTIONS.map((ft) => (
              <option key={ft.id} value={ft.id}>{ft.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="new-f-floor">Floor level (e.g. Ground, 2nd Floor)</label>
          <input
            id="new-f-floor"
            value={facility.floor_level}
            onChange={(e) => setFacility({ ...facility, floor_level: e.target.value })}
            placeholder="Ground"
          />
        </div>
        <div className="field">
          <label htmlFor="new-f-desc">Location description</label>
          <textarea
            id="new-f-desc"
            rows={2}
            value={facility.location_description}
            onChange={(e) => setFacility({ ...facility, location_description: e.target.value })}
            placeholder="e.g. Near the main lobby, left of the entrance"
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5em", fontWeight: 400, marginBottom: "1em" }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={facility.is_accessible}
            onChange={(e) => setFacility({ ...facility, is_accessible: e.target.checked })}
          />
          This facility is accessible
        </label>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save facility"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main PlaceDetail page
// ---------------------------------------------------------------------------
export default function PlaceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placeImages, setPlaceImages] = useState([]);

  function load() {
    PlacesAPI.detail(id).then((res) => setPlace(res.data)).finally(() => setLoading(false));
    ImagesAPI.list("place", id).then((res) => setPlaceImages(res.data.results || res.data));
  }

  useEffect(load, [id]);

  if (loading) return <main className="container" style={{ padding: "2rem" }}><p className="muted">Loading…</p></main>;
  if (!place) return <main className="container" style={{ padding: "2rem" }}><p>Place not found.</p></main>;

  return (
    <main className="container" style={{ padding: "2rem 1.25rem", maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <p className="muted" style={{ margin: 0 }}>{place.category_name}</p>
          <h1 style={{ margin: "0.1em 0" }}>{place.name}</h1>
          <p className="muted">{place.address || place.city}</p>
        </div>
        <ConfidenceBadge score={place.overall_accessibility_score} />
      </div>

      {place.description && <p style={{ marginTop: "0.5rem" }}>{place.description}</p>}

      {placeImages.length > 0 && (
        <div style={{ display: "flex", gap: "0.6em", marginTop: "0.8em", flexWrap: "wrap" }}>
          {placeImages.map((img) => (
            <img
              key={img.id}
              src={ImagesAPI.thumbUrl(img.id)}
              alt={img.alt_text}
              style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid var(--color-border)" }}
            />
          ))}
        </div>
      )}

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Access points</h2>
        {place.access_points?.length ? (
          place.access_points.map((ap) => (
            <AccessPointCard key={ap.id} accessPoint={ap} placeId={place.id} onChanged={load} />
          ))
        ) : (
          <p className="muted">No access points recorded yet.</p>
        )}
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Facilities</h2>
        </div>
        {place.facilities?.length ? (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.7rem", marginTop: "0.8rem" }}>
            {place.facilities.map((f) => (
              <li key={f.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{f.facility_type_name}</strong>
                    {f.floor_level && <span className="muted"> · {f.floor_level}</span>}
                    {f.location_description && <p className="muted" style={{ margin: "0.2em 0 0" }}>{f.location_description}</p>}
                  </div>
                  <span className={`confidence-badge ${f.is_accessible ? "high" : "low"}`}>
                    <span className="dot" aria-hidden="true" />
                    {f.is_accessible ? "Accessible" : "Not accessible"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No facilities recorded yet.</p>
        )}

        {/* Only logged-in users can add facilities to an existing building */}
        {user && (
          <AddFacilityForm placeId={place.id} onAdded={load} />
        )}
        {!user && (
          <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
            <Link to="/login">Log in</Link> to add a facility to this building.
          </p>
        )}
      </section>
    </main>
  );
}
