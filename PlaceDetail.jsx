import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PlacesAPI, AccessPointsAPI, ImagesAPI, FloorPlansAPI } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ConfidenceBadge from "../components/ConfidenceBadge";

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

export default function PlaceDetail() {
  const { id } = useParams();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placeImages, setPlaceImages] = useState([]);
  const [floorPlans, setFloorPlans] = useState([]);

  function load() {
    PlacesAPI.detail(id).then((res) => setPlace(res.data)).finally(() => setLoading(false));
    ImagesAPI.list("place", id).then((res) => setPlaceImages(res.data.results || res.data));
    FloorPlansAPI.list(id).then((res) => setFloorPlans(res.data.results || res.data)).catch(() => setFloorPlans([]));
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

      {floorPlans.length > 0 && (
        <div className="card" style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Indoor navigation available</strong>
            <p className="muted" style={{ margin: 0 }}>{floorPlans.length} floor{floorPlans.length > 1 ? "s" : ""} mapped</p>
          </div>
          <Link to={`/places/${place.id}/navigate`}><button className="btn-primary">Navigate inside</button></Link>
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
        <h2>Facilities</h2>
        {place.facilities?.length ? (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.7rem" }}>
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
      </section>
    </main>
  );
}
