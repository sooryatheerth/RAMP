import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  PlacesAPI, AccessPointsAPI, FacilitiesAPI, ImagesAPI, AttributeDefinitionsAPI
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import ConfidenceBadge from "../components/ConfidenceBadge";
import RewardTierBadge from "../components/RewardTierBadge";
import ScoreBreakdownModal from "../components/ScoreBreakdownModal";
import ImageLightbox from "../components/ImageLightbox";
import UploadPhotoModal from "../components/UploadPhotoModal";
import BookmarkButton from "../components/BookmarkButton";
import ReviewsSection from "../components/ReviewsSection";

// ---------------------------------------------------------------------------
// Unified Attribute row with confirm / dispute buttons (AccessPoint or Facility)
// ---------------------------------------------------------------------------
function AttributeRow({ attribute, placeId, accessPointId, facilityId, onVerified }) {
  const { user, refreshUser } = useAuth();
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
      if (accessPointId) {
        await AccessPointsAPI.verifyAttribute(placeId, accessPointId, attribute.id, { action });
      } else if (facilityId) {
        await FacilitiesAPI.verifyAttribute(placeId, facilityId, attribute.id, { action });
      }
      if (refreshUser) refreshUser();
      onVerified();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not submit verification.");
    } finally {
      setBusy(false);
    }
  }

  const isOwner = user && (user.id === attribute.submitted_by || user.username === attribute.submitted_by_username);
  const userAction = attribute.user_action;

  return (
    <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55em 0", borderBottom: "1px solid var(--color-border)", flexWrap: "wrap", gap: "0.4rem" }}>
      <div>
        <strong>{attribute.attribute_name}:</strong> {String(displayValue)}{" "}
        <span
          style={{ ...statusStyles[attribute.verification_status], padding: "0.1em 0.5em", borderRadius: 999, fontSize: "0.78rem", fontWeight: 700, marginLeft: "0.4em" }}
        >
          {attribute.verification_status}
        </span>
        {attribute.verified_count > 0 && (
          <span className="muted" style={{ fontSize: "0.78rem", marginLeft: "0.4em" }}>
            ({attribute.verified_count} {attribute.verified_count === 1 ? "confirmation" : "confirmations"})
          </span>
        )}
        {attribute.submitted_by_username && (
          <span className="muted" style={{ fontSize: "0.78rem", marginLeft: "0.5em", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
            · by {attribute.submitted_by_username}
            {attribute.submitted_by_tier && (
              <RewardTierBadge tier={attribute.submitted_by_tier.tier} title={attribute.submitted_by_tier.title} size="sm" showTitle={false} />
            )}
          </span>
        )}
      </div>
      {user && (
        <div style={{ display: "flex", gap: "0.4em", alignItems: "center" }}>
          {isOwner ? (
            <span className="muted" style={{ fontSize: "0.8rem", fontStyle: "italic" }}>
              (Your submission)
            </span>
          ) : userAction === "confirm" ? (
            <span style={{ fontSize: "0.8rem", color: "var(--color-primary-dark)", fontWeight: 600 }}>
              ✓ Confirmed (+2 pts)
            </span>
          ) : userAction === "dispute" ? (
            <span style={{ fontSize: "0.8rem", color: "var(--color-danger)", fontWeight: 600 }}>
              ⚠ Disputed
            </span>
          ) : (
            <>
              <button className="btn-secondary" style={{ fontSize: "0.78rem", padding: "0.25em 0.6em" }} disabled={busy} onClick={() => handleVerify("confirm")}>
                Confirm (+2 pts)
              </button>
              <button className="btn-secondary" style={{ fontSize: "0.78rem", padding: "0.25em 0.6em" }} disabled={busy} onClick={() => handleVerify("dispute")}>
                Dispute
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Access point card with attributes and photo upload
// ---------------------------------------------------------------------------
function AccessPointCard({ accessPoint, placeId, onChanged, onOpenPhoto }) {
  const { user } = useAuth();
  const [attributes, setAttributes] = useState([]);
  const [images, setImages] = useState([]);
  const [showAddAttr, setShowAddAttr] = useState(false);
  const [attrDefs, setAttrDefs] = useState([]);
  const [selectedDefId, setSelectedDefId] = useState("");
  const [attrValue, setAttrValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  function loadAttributes() {
    AccessPointsAPI.attributes(placeId, accessPoint.id).then((res) => setAttributes(res.data.results || res.data));
  }

  function loadImages() {
    ImagesAPI.list("access_point", accessPoint.id).then((res) => setImages(res.data.results || res.data));
  }

  useEffect(() => {
    loadAttributes();
    loadImages();
    AttributeDefinitionsAPI.list({ applies_to: "access_point" })
      .then((res) => setAttrDefs(res.data.results || res.data))
      .catch(() => {});
  }, [accessPoint.id]);

  function handleVerified() {
    loadAttributes();
    if (onChanged) onChanged();
  }

  async function handleAddAttribute(e) {
    e.preventDefault();
    if (!selectedDefId) return;
    setBusy(true);
    try {
      const def = attrDefs.find((d) => d.id === parseInt(selectedDefId));
      const payload = { attribute_definition: def.id };
      if (def.data_type === "boolean") payload.value_boolean = attrValue === "true";
      else if (def.data_type === "number") payload.value_number = parseFloat(attrValue);
      else payload.value_text = attrValue;

      await AccessPointsAPI.submitAttribute(placeId, accessPoint.id, payload);
      setShowAddAttr(false);
      setSelectedDefId("");
      setAttrValue("");
      loadAttributes();
      if (onChanged) onChanged();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not save attribute.");
    } finally {
      setBusy(false);
    }
  }

  const selectedDef = attrDefs.find((d) => d.id === parseInt(selectedDefId));

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>{accessPoint.label}</h3>
            {accessPoint.is_primary_accessible_entrance && (
              <span style={{ fontSize: "0.75rem", padding: "0.15em 0.55em", borderRadius: 999, background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>
                ★ Primary Accessible Entrance
              </span>
            )}
          </div>
          {accessPoint.notes && <p className="muted" style={{ margin: "0.3rem 0 0", fontSize: "0.9rem" }}>{accessPoint.notes}</p>}
        </div>
        <span className={`confidence-badge ${accessPoint.is_accessible ? "high" : "low"}`}>
          <span className="dot" aria-hidden="true" />
          {accessPoint.is_accessible ? "Accessible entrance" : "Not marked accessible"}
        </span>
      </div>

      {/* Access point photos */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        {images.map((img, idx) => (
          <img
            key={img.id}
            src={ImagesAPI.thumbUrl(img.id)}
            alt={img.alt_text}
            title="Click to view full photo"
            onClick={() => onOpenPhoto(images, idx)}
            style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid var(--color-border)", cursor: "pointer" }}
          />
        ))}
        {user && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowPhotoModal(true)}
            style={{ height: 80, padding: "0 0.8rem", fontSize: "0.8rem", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.2rem" }}
          >
            <span>📷</span>
            <span>+ Add photo</span>
          </button>
        )}
      </div>

      {/* Attributes List */}
      <div style={{ marginTop: "0.8rem" }}>
        {attributes.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {attributes.map((attr) => (
              <AttributeRow
                key={attr.id}
                attribute={attr}
                placeId={placeId}
                accessPointId={accessPoint.id}
                onVerified={handleVerified}
              />
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ fontSize: "0.85rem", margin: "0.5rem 0" }}>No measurements recorded for this entrance yet.</p>
        )}
      </div>

      {/* Add attribute to access point */}
      {user && !showAddAttr && (
        <button
          className="btn-link"
          style={{ marginTop: "0.5rem", fontSize: "0.85rem", padding: 0 }}
          onClick={() => setShowAddAttr(true)}
        >
          + Add measurement or trait (e.g. door width, slope)
        </button>
      )}

      {showAddAttr && (
        <form onSubmit={handleAddAttribute} style={{ marginTop: "0.8rem", padding: "0.8rem", background: "#f8fafc", borderRadius: 8, border: "1px solid var(--color-border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Attribute</label>
              <select required value={selectedDefId} onChange={(e) => { setSelectedDefId(e.target.value); setAttrValue(""); }}>
                <option value="">Select an attribute</option>
                {attrDefs.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} {d.unit ? `(${d.unit})` : ""}</option>
                ))}
              </select>
            </div>
            {selectedDef && (
              <div className="field" style={{ margin: 0 }}>
                <label>Value {selectedDef.unit ? `(${selectedDef.unit})` : ""}</label>
                {selectedDef.data_type === "boolean" ? (
                  <select required value={attrValue} onChange={(e) => setAttrValue(e.target.value)}>
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : selectedDef.data_type === "number" ? (
                  <input type="number" step="any" required placeholder="Number" value={attrValue} onChange={(e) => setAttrValue(e.target.value)} />
                ) : (
                  <input type="text" required placeholder="Details" value={attrValue} onChange={(e) => setAttrValue(e.target.value)} />
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.6rem" }}>
            <button type="button" className="btn-secondary" style={{ fontSize: "0.82rem" }} onClick={() => setShowAddAttr(false)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ fontSize: "0.82rem" }} disabled={busy || !selectedDefId}>
              {busy ? "Saving…" : "Save attribute"}
            </button>
          </div>
        </form>
      )}

      {showPhotoModal && (
        <UploadPhotoModal
          entityType="access_point"
          entityId={accessPoint.id}
          title={`Upload photo of ${accessPoint.label}`}
          onClose={() => setShowPhotoModal(false)}
          onUploaded={() => { loadImages(); if (onChanged) onChanged(); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Facility Card with Attributes & Verification
// ---------------------------------------------------------------------------
function FacilityCard({ facility, placeId, onChanged }) {
  const { user } = useAuth();
  const [attributes, setAttributes] = useState([]);
  const [showAddAttr, setShowAddAttr] = useState(false);
  const [attrDefs, setAttrDefs] = useState([]);
  const [selectedDefId, setSelectedDefId] = useState("");
  const [attrValue, setAttrValue] = useState("");
  const [busy, setBusy] = useState(false);

  function loadAttributes() {
    FacilitiesAPI.attributes(placeId, facility.id)
      .then((res) => setAttributes(res.data.results || res.data))
      .catch(() => {});
  }

  useEffect(() => {
    loadAttributes();
    AttributeDefinitionsAPI.list()
      .then((res) => {
        const all = res.data.results || res.data;
        // Match attributes for this facility type or general
        setAttrDefs(all.filter((d) => d.applies_to === "facility" || d.applies_to === "both"));
      })
      .catch(() => {});
  }, [facility.id]);

  function handleVerified() {
    loadAttributes();
    if (onChanged) onChanged();
  }

  async function handleAddAttribute(e) {
    e.preventDefault();
    if (!selectedDefId) return;
    setBusy(true);
    try {
      const def = attrDefs.find((d) => d.id === parseInt(selectedDefId));
      const payload = { attribute_definition: def.id };
      if (def.data_type === "boolean") payload.value_boolean = attrValue === "true";
      else if (def.data_type === "number") payload.value_number = parseFloat(attrValue);
      else payload.value_text = attrValue;

      await FacilitiesAPI.submitAttribute(placeId, facility.id, payload);
      setShowAddAttr(false);
      setSelectedDefId("");
      setAttrValue("");
      loadAttributes();
      if (onChanged) onChanged();
    } catch (err) {
      alert(err.response?.data?.detail || "Could not save attribute.");
    } finally {
      setBusy(false);
    }
  }

  const selectedDef = attrDefs.find((d) => d.id === parseInt(selectedDefId));

  return (
    <li className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div>
          <strong>{facility.facility_type_name}</strong>
          {facility.floor_level && <span className="muted"> · {facility.floor_level}</span>}
          {facility.location_description && <p className="muted" style={{ margin: "0.2em 0 0", fontSize: "0.9rem" }}>{facility.location_description}</p>}
        </div>
        <span className={`confidence-badge ${facility.is_accessible ? "high" : "low"}`}>
          <span className="dot" aria-hidden="true" />
          {facility.is_accessible ? "Accessible" : "Not accessible"}
        </span>
      </div>

      {/* Facility Attributes */}
      {attributes.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0.6rem 0 0" }}>
          {attributes.map((attr) => (
            <AttributeRow
              key={attr.id}
              attribute={attr}
              placeId={placeId}
              facilityId={facility.id}
              onVerified={handleVerified}
            />
          ))}
        </ul>
      )}

      {/* Add attribute to facility */}
      {user && !showAddAttr && (
        <button
          className="btn-link"
          style={{ marginTop: "0.5rem", fontSize: "0.82rem", padding: 0 }}
          onClick={() => setShowAddAttr(true)}
        >
          + Add feature details (e.g. grab bars, button height)
        </button>
      )}

      {showAddAttr && (
        <form onSubmit={handleAddAttribute} style={{ marginTop: "0.6rem", padding: "0.75rem", background: "#f8fafc", borderRadius: 8, border: "1px solid var(--color-border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontSize: "0.8rem" }}>Feature / Attribute</label>
              <select required value={selectedDefId} onChange={(e) => { setSelectedDefId(e.target.value); setAttrValue(""); }}>
                <option value="">Select feature</option>
                {attrDefs.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} {d.unit ? `(${d.unit})` : ""}</option>
                ))}
              </select>
            </div>
            {selectedDef && (
              <div className="field" style={{ margin: 0 }}>
                <label style={{ fontSize: "0.8rem" }}>Value</label>
                {selectedDef.data_type === "boolean" ? (
                  <select required value={attrValue} onChange={(e) => setAttrValue(e.target.value)}>
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : selectedDef.data_type === "number" ? (
                  <input type="number" step="any" required placeholder="Number" value={attrValue} onChange={(e) => setAttrValue(e.target.value)} />
                ) : (
                  <input type="text" required placeholder="Details" value={attrValue} onChange={(e) => setAttrValue(e.target.value)} />
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="button" className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => setShowAddAttr(false)}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ fontSize: "0.8rem" }} disabled={busy || !selectedDefId}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Add Access Point Form for logged-in users
// ---------------------------------------------------------------------------
function AddAccessPointForm({ place, onAdded }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [isAccessible, setIsAccessible] = useState(true);
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) { setError("Please give this entrance a label."); return; }
    setBusy(true);
    setError("");

    try {
      const payload = {
        label: label.trim(),
        location: place.primary_location,
        is_accessible: isAccessible,
        is_primary_accessible_entrance: isPrimary,
        notes: notes.trim(),
      };
      await AccessPointsAPI.create(place.id, payload);
      setLabel("");
      setNotes("");
      setIsAccessible(true);
      setIsPrimary(false);
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save access entrance.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        className="btn-secondary"
        style={{ marginTop: "0.5rem" }}
        onClick={() => setOpen(true)}
      >
        + Add an entrance / access point
      </button>
    );
  }

  return (
    <div className="card" style={{ marginTop: "1rem", border: "1.5px solid var(--color-primary)" }}>
      <h3 style={{ marginTop: 0 }}>Add an Entrance to {place.name}</h3>
      {error && <p className="error-text" role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="ap-label">Entrance Label <span style={{ color: "var(--color-danger)" }}>*</span></label>
          <input
            id="ap-label"
            required
            placeholder="e.g. North Side Ramp, Rear Courtyard Entrance, Elevator Lobby"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "1.2rem", margin: "0.8rem 0", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4em", fontWeight: 400 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={isAccessible}
              onChange={(e) => setIsAccessible(e.target.checked)}
            />
            Entrance is step-free & accessible
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4em", fontWeight: 400 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
            />
            Primary accessible entrance
          </label>
        </div>

        <div className="field">
          <label htmlFor="ap-notes">Notes or navigation guidance</label>
          <textarea
            id="ap-notes"
            rows={2}
            placeholder="e.g. Automatic sliding door with push pad, leads directly to reception"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving entrance…" : "Save Entrance"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Add Facility Form
// ---------------------------------------------------------------------------
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
// Main PlaceDetail Page
// ---------------------------------------------------------------------------
export default function PlaceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placeImages, setPlaceImages] = useState([]);

  // Modal and Lightbox states
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [lightboxImages, setLightboxImages] = useState(null); // array of images
  const [lightboxIndex, setLightboxIndex] = useState(0);

  function load() {
    PlacesAPI.detail(id)
      .then((res) => setPlace(res.data))
      .finally(() => setLoading(false));
    ImagesAPI.list("place", id)
      .then((res) => setPlaceImages(res.data.results || res.data));
  }

  useEffect(load, [id]);

  function handleOpenLightbox(images, index) {
    setLightboxImages(images);
    setLightboxIndex(index);
  }

  if (loading) return <main className="container" style={{ padding: "2rem" }}><p className="muted">Loading place details…</p></main>;
  if (!place) return <main className="container" style={{ padding: "2rem" }}><p>Place not found.</p></main>;

  // Find primary accessible entrance if available for directions
  const primaryEntrance = place.access_points?.find((ap) => ap.is_primary_accessible_entrance && ap.is_accessible) ||
    place.access_points?.find((ap) => ap.is_accessible);

  const navCoords = primaryEntrance?.location || place.primary_location;
  const directionsUrl = navCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${navCoords.lat},${navCoords.lng}`
    : null;

  return (
    <main className="container" style={{ padding: "2rem 1.25rem 4rem", maxWidth: 840 }}>
      {/* ── Place Header with Confidence Score & Bookmarks ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <p className="muted" style={{ margin: 0, textTransform: "uppercase", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.03em" }}>
              {place.category_name}
            </p>
            {place.average_rating ? (
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "0.1em 0.5em", borderRadius: 999 }}>
                ★ {place.average_rating} ({place.reviews_count})
              </span>
            ) : null}
          </div>
          <h1 style={{ margin: "0.15em 0 0.3em" }}>{place.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="muted">{place.address || place.city}</span>
            {place.added_by_username && (
              <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
                <span>·</span>
                <span>Mapped by <strong>{place.added_by_username}</strong></span>
                {place.added_by_tier && (
                  <RewardTierBadge tier={place.added_by_tier.tier} title={place.added_by_tier.title} size="sm" showTitle={false} />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Action badges: Confidence score & Bookmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <BookmarkButton placeId={place.id} initialSaved={place.is_saved} size="md" />
          <div
            onClick={() => setShowScoreModal(true)}
            style={{ cursor: "pointer" }}
            title="Click to view detailed accessibility score breakdown"
          >
            <ConfidenceBadge score={place.overall_accessibility_score} />
          </div>
        </div>
      </div>

      {/* Navigation action bar */}
      <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          className="btn-secondary"
          onClick={() => setShowScoreModal(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.88rem" }}
        >
          <span>📊</span>
          <span>View score breakdown</span>
        </button>

        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.88rem" }}
          >
            <span>🧭</span>
            <span>Navigate to entrance</span>
          </a>
        )}

        {user && (
          <button
            className="btn-secondary"
            onClick={() => setShowUploadModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.88rem" }}
          >
            <span>📷</span>
            <span>Add photo</span>
          </button>
        )}
      </div>

      {place.description && <p style={{ marginTop: "1rem", fontSize: "1.05rem", lineHeight: 1.5 }}>{place.description}</p>}

      {/* Place Photos Gallery */}
      {placeImages.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <span className="muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>Photos ({placeImages.length}):</span>
          <div style={{ display: "flex", gap: "0.6em", marginTop: "0.4em", flexWrap: "wrap" }}>
            {placeImages.map((img, idx) => (
              <img
                key={img.id}
                src={ImagesAPI.thumbUrl(img.id)}
                alt={img.alt_text}
                title="Click to view full photo"
                onClick={() => handleOpenLightbox(placeImages, idx)}
                style={{
                  width: 110,
                  height: 110,
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "1px solid var(--color-border)",
                  cursor: "pointer",
                  transition: "transform 0.15s ease",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Access Points Section ── */}
      <section style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Entrances & Access Points</h2>
        </div>
        <p className="muted" style={{ margin: "0.2rem 0 0.8rem", fontSize: "0.9rem" }}>
          Physical doors and entryways into this building with verified door clearances and ramp slopes.
        </p>

        {place.access_points?.length ? (
          place.access_points.map((ap) => (
            <AccessPointCard
              key={ap.id}
              accessPoint={ap}
              placeId={place.id}
              onChanged={load}
              onOpenPhoto={handleOpenLightbox}
            />
          ))
        ) : (
          <p className="muted">No access points recorded yet.</p>
        )}

        {user && <AddAccessPointForm place={place} onAdded={load} />}
      </section>

      {/* ── Facilities Section ── */}
      <section style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Amenities & Facilities</h2>
        </div>
        <p className="muted" style={{ margin: "0.2rem 0 0.8rem", fontSize: "0.9rem" }}>
          Interior amenities like wheelchair-accessible restrooms, elevators, tactile paths, and parking.
        </p>

        {place.facilities?.length ? (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.7rem" }}>
            {place.facilities.map((f) => (
              <FacilityCard key={f.id} facility={f} placeId={place.id} onChanged={load} />
            ))}
          </ul>
        ) : (
          <p className="muted">No facilities recorded yet.</p>
        )}

        {user && <AddFacilityForm placeId={place.id} onAdded={load} />}
        {!user && (
          <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
            <Link to="/login">Log in</Link> to add entrance or facility details.
          </p>
        )}
      </section>

      {/* ── Community Reviews Section (Feature 4) ── */}
      <ReviewsSection placeId={place.id} placeName={place.name} />

      {/* ── Interactive Score Breakdown Modal (Feature 1) ── */}
      {showScoreModal && (
        <ScoreBreakdownModal
          placeId={place.id}
          placeName={place.name}
          currentScore={place.overall_accessibility_score}
          onClose={() => setShowScoreModal(false)}
        />
      )}

      {/* ── Full Photo Lightbox (Feature 1) ── */}
      {lightboxImages && (
        <ImageLightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxImages(null)}
          onNavigate={(newIdx) => setLightboxIndex(newIdx)}
        />
      )}

      {/* ── Upload Place Photo Modal (Feature 1) ── */}
      {showUploadModal && (
        <UploadPhotoModal
          entityType="place"
          entityId={place.id}
          title={`Upload photo for ${place.name}`}
          onClose={() => setShowUploadModal(false)}
          onUploaded={load}
        />
      )}
    </main>
  );
}
