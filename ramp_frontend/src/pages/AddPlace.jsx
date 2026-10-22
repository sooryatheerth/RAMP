import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  PlacesAPI, AccessPointsAPI, FacilitiesAPI,
  AttributeDefinitionsAPI, ImagesAPI, FacilityTypesAPI,
} from "../api/client";

const STEPS = ["Place details", "Main entrance", "Facilities (optional)", "Photo (optional)"];

// Debounce helper — waits `delay` ms after the last call before invoking fn.
function useDebounce(fn, delay) {
  const [timer, setTimer] = useState(null);
  return useCallback((...args) => {
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => fn(...args), delay));
  }, [fn, delay, timer]);
}

export default function AddPlace() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const prefilled = routerLocation.state; // { lat, lng } if the user came from the map click flow

  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Step 1: place
  const [place, setPlace] = useState({
    name: prefilled?.name ?? "",
    category: prefilled?.category ?? "",
    description: prefilled?.description ?? "",
    address: prefilled?.address ?? "",
    city: prefilled?.city ?? "",
    lat: prefilled?.lat ?? "",
    lng: prefilled?.lng ?? "",
  });

  // Step 2: main access point + a couple of common attributes
  const [accessPoint, setAccessPoint] = useState({
    label: "Main Entrance", lat: "", lng: "", is_accessible: false, notes: "",
  });
  const [rampGradient, setRampGradient] = useState("");
  const [doorWidth, setDoorWidth] = useState("");
  const [stepCount, setStepCount] = useState("");
  const [attributeDefs, setAttributeDefs] = useState([]);

  // Step 3: facility
  const [addFacility, setAddFacility] = useState(false);
  const [facility, setFacility] = useState({ facility_type: "", floor_level: "", location_description: "", is_accessible: false });
  const [facilityTypes, setFacilityTypes] = useState([]);

  // Step 4: photo (of the place itself)
  const [photoFile, setPhotoFile] = useState(null);
  const [altText, setAltText] = useState("");

  // Created ids, filled in as we go
  const [createdPlaceId, setCreatedPlaceId] = useState(null);
  const [createdAccessPointId, setCreatedAccessPointId] = useState(null);

  // Duplicate building detection
  const [nearbyPlaces, setNearbyPlaces] = useState([]);   // list of existing places within 50 m
  const [nearbyDismissed, setNearbyDismissed] = useState(false);  // user explicitly chose to continue anyway
  const [nearbyLoading, setNearbyLoading] = useState(false);

  useEffect(() => {
    PlacesAPI.categories().then((res) => setCategories(res.data.results || res.data));
    AttributeDefinitionsAPI.list({ applies_to: "access_point" }).then((res) =>
      setAttributeDefs(res.data.results || res.data)
    );
    FacilityTypesAPI.list().then((res) => setFacilityTypes(res.data.results || res.data)).catch(() => {});
  }, []);

  // Run the nearby check whenever lat/lng are valid numbers.
  // We only show the warning when the user hasn't explicitly dismissed it yet.
  async function checkNearby(lat, lng) {
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) { setNearbyPlaces([]); return; }
    setNearbyLoading(true);
    try {
      const res = await PlacesAPI.nearby(numLat, numLng, 50);
      setNearbyPlaces(res.data || []);
      setNearbyDismissed(false); // reset dismissal on new coordinates
    } catch {
      setNearbyPlaces([]); // fail silently — don't block submission
    } finally {
      setNearbyLoading(false);
    }
  }

  // Trigger nearby check whenever coordinates change (prefilled or typed)
  useEffect(() => {
    if (prefilled?.lat && prefilled?.lng) {
      checkNearby(prefilled.lat, prefilled.lng);
    }
  }, []);

  function handleLatLngChange(field, value) {
    const updated = { ...place, [field]: value };
    setPlace(updated);
    if (updated.lat && updated.lng) {
      checkNearby(updated.lat, updated.lng);
    }
  }

  function findAttrId(name) {
    return attributeDefs.find((a) => a.name === name)?.id;
  }

  async function handleCreatePlaceAndAccessPoint() {
    setBusy(true);
    setError("");
    try {
      const { data: newPlace } = await PlacesAPI.create({
        name: place.name,
        category: place.category,
        description: place.description,
        address: place.address,
        city: place.city,
        primary_location: { lat: parseFloat(place.lat), lng: parseFloat(place.lng) },
      });
      setCreatedPlaceId(newPlace.id);

      const { data: newAP } = await AccessPointsAPI.create(newPlace.id, {
        label: accessPoint.label,
        location: { lat: parseFloat(accessPoint.lat || place.lat), lng: parseFloat(accessPoint.lng || place.lng) },
        is_accessible: accessPoint.is_accessible,
        is_primary_accessible_entrance: accessPoint.is_accessible,
        notes: accessPoint.notes,
      });
      setCreatedAccessPointId(newAP.id);

      // Submit any attribute values the user filled in
      const attrSubmissions = [
        rampGradient && { attribute_definition: findAttrId("Ramp Gradient"), value_number: rampGradient },
        doorWidth && { attribute_definition: findAttrId("Door Width"), value_number: doorWidth },
        stepCount && { attribute_definition: findAttrId("Step Count"), value_number: stepCount },
      ].filter(Boolean);

      await Promise.all(
        attrSubmissions
          .filter((a) => a.attribute_definition)
          .map((a) => AccessPointsAPI.submitAttribute(newPlace.id, newAP.id, a))
      );

      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save the place. Check the fields and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddFacility() {
    setBusy(true);
    setError("");
    try {
      await FacilitiesAPI.create(createdPlaceId, facility);
      setStep(3);
    } catch (err) {
      setError("Could not save the facility.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadPhoto() {
    if (!photoFile) return navigate(`/places/${createdPlaceId}`);
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", photoFile);
      formData.append("entity_type", "place");
      formData.append("entity_id", createdPlaceId);
      formData.append("alt_text", altText);
      await ImagesAPI.upload(formData);
      navigate(`/places/${createdPlaceId}`);
    } catch (err) {
      setError(err.response?.data?.alt_text?.[0] || "Could not upload the photo.");
    } finally {
      setBusy(false);
    }
  }

  // Whether we should show the duplicate warning (places found + not dismissed)
  const showNearbyWarning = nearbyPlaces.length > 0 && !nearbyDismissed && step === 0;

  return (
    <main className="container" style={{ padding: "2.5rem 1.25rem 4rem", maxWidth: 620 }}>
      {/* ── Wizard Header with Progress Bar ── */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.75rem" }}>Add a Place</h1>
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--color-primary-dark)",
              background: "var(--color-primary-light)",
              padding: "0.2em 0.7em",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--color-primary-border)",
            }}
          >
            Step {step + 1} of {STEPS.length}
          </span>
        </div>

        {/* Multi-step progress track */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${STEPS.length}, 1fr)`, gap: "0.4rem", marginTop: "0.75rem" }}>
          {STEPS.map((stepName, idx) => {
            const isCompleted = idx < step;
            const isCurrent = idx === step;
            return (
              <div key={stepName}>
                <div
                  style={{
                    height: 5,
                    borderRadius: 999,
                    background: isCompleted || isCurrent ? "var(--color-primary)" : "var(--color-border)",
                    boxShadow: isCurrent ? "0 0 8px rgba(15,118,110,0.4)" : "none",
                    transition: "all 0.25s ease",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? "var(--color-primary-dark)" : "var(--color-text-muted)",
                    display: "block",
                    marginTop: "0.35rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {idx + 1}. {stepName.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "0.6rem 0.85rem",
            background: "var(--color-danger-light)",
            border: "1px solid var(--color-danger-border)",
            borderRadius: "var(--radius)",
            marginBottom: "1rem",
          }}
        >
          <p className="error-text" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {/* ── Duplicate Building Warning ────────────────────────────────────── */}
      {showNearbyWarning && (
        <div
          role="alert"
          style={{
            background: "var(--color-warn-light, #fff8e1)",
            border: "1.5px solid var(--color-warn, #f5a623)",
            borderRadius: 10,
            padding: "1rem 1.1rem",
            marginBottom: "1.1rem",
          }}
        >
          <strong style={{ display: "block", marginBottom: "0.4em" }}>
            ⚠️ Similar building{nearbyPlaces.length > 1 ? "s" : ""} already exist nearby
          </strong>
          <p style={{ margin: "0 0 0.7em", fontSize: "0.92rem" }}>
            The following place{nearbyPlaces.length > 1 ? "s are" : " is"} within 50&nbsp;m of the location you entered.
            If this is the same building, please add your information as a <strong>facility</strong> to the existing entry instead of creating a duplicate.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.8em", display: "grid", gap: "0.5rem" }}>
            {nearbyPlaces.map((np) => (
              <li
                key={np.id}
                style={{
                  background: "var(--color-surface, #fff)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  padding: "0.55em 0.85em",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <strong>{np.name}</strong>
                  {np.category_name && (
                    <span className="muted" style={{ marginLeft: "0.4em", fontSize: "0.85rem" }}>
                      · {np.category_name}
                    </span>
                  )}
                </div>
                <button
                  className="btn-primary"
                  style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}
                  onClick={() => navigate(`/places/${np.id}`)}
                >
                  Add facility to this building
                </button>
              </li>
            ))}
          </ul>
          <button
            className="btn-secondary"
            style={{ fontSize: "0.85rem" }}
            onClick={() => setNearbyDismissed(true)}
          >
            This is a different place — continue adding
          </button>
        </div>
      )}
      {nearbyLoading && (
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.6rem" }}>
          Checking for existing nearby buildings…
        </p>
      )}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {step === 0 && (
        <div className="card">
          <div className="field">
            <label htmlFor="p-name">Place name</label>
            <input id="p-name" required value={place.name} onChange={(e) => setPlace({ ...place, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="p-category">Category</label>
            <select id="p-category" required value={place.category} onChange={(e) => setPlace({ ...place, category: e.target.value })}>
              <option value="">Select a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="p-description">Description</label>
            <textarea
              id="p-description"
              rows={3}
              placeholder="What is this place? Anything visitors should know?"
              value={place.description}
              onChange={(e) => setPlace({ ...place, description: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="p-address">Address</label>
            <input id="p-address" value={place.address} onChange={(e) => setPlace({ ...place, address: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="p-city">City</label>
            <input id="p-city" value={place.city} onChange={(e) => setPlace({ ...place, city: e.target.value })} />
          </div>

          {prefilled?.lat ? (
            <div className="field">
              <label>Location</label>
              <p className="muted" style={{ margin: 0 }}>
                📍 {Number(place.lat).toFixed(5)}, {Number(place.lng).toFixed(5)} — picked from the map
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: "0.8rem" }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="p-lat">Latitude</label>
                  <input
                    id="p-lat"
                    required
                    type="number"
                    step="any"
                    value={place.lat}
                    onChange={(e) => handleLatLngChange("lat", e.target.value)}
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="p-lng">Longitude</label>
                  <input
                    id="p-lng"
                    required
                    type="number"
                    step="any"
                    value={place.lng}
                    onChange={(e) => handleLatLngChange("lng", e.target.value)}
                  />
                </div>
              </div>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                Tip: go back to the home page and click the map instead of typing coordinates.
              </p>
            </>
          )}

          <button
            className="btn-primary"
            disabled={!place.name || !place.category || !place.lat || !place.lng}
            onClick={() => setStep(1)}
          >
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <p className="muted">Tell us about the main way people enter this place.</p>
          <div className="field">
            <label htmlFor="ap-label">Entrance label</label>
            <input id="ap-label" value={accessPoint.label} onChange={(e) => setAccessPoint({ ...accessPoint, label: e.target.value })} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5em", fontWeight: 400, marginBottom: "1em" }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={accessPoint.is_accessible}
              onChange={(e) => setAccessPoint({ ...accessPoint, is_accessible: e.target.checked })}
            />
            This entrance is wheelchair accessible
          </label>

          <div style={{ display: "flex", gap: "0.8rem" }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="ramp-gradient">Ramp gradient (degrees, if known)</label>
              <input id="ramp-gradient" type="number" step="any" value={rampGradient} onChange={(e) => setRampGradient(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="door-width">Door width (cm, if known)</label>
              <input id="door-width" type="number" step="any" value={doorWidth} onChange={(e) => setDoorWidth(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="step-count">Number of steps (if any)</label>
            <input id="step-count" type="number" value={stepCount} onChange={(e) => setStepCount(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ap-notes">Notes</label>
            <textarea id="ap-notes" rows={3} value={accessPoint.notes} onChange={(e) => setAccessPoint({ ...accessPoint, notes: e.target.value })} />
          </div>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn-secondary" onClick={() => setStep(0)}>Back</button>
            <button className="btn-primary" disabled={busy} onClick={handleCreatePlaceAndAccessPoint}>
              {busy ? "Saving…" : "Save and continue"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <label style={{ display: "flex", alignItems: "center", gap: "0.5em", fontWeight: 400, marginBottom: "1em" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={addFacility} onChange={(e) => setAddFacility(e.target.checked)} />
            Add a facility (restroom, elevator, parking, etc.)
          </label>

          {addFacility && (
            <>
              <div className="field">
                <label htmlFor="f-type">Facility type</label>
                <select
                  id="f-type"
                  value={facility.facility_type}
                  onChange={(e) => setFacility({ ...facility, facility_type: e.target.value })}
                >
                  <option value="">Select a type</option>
                  {facilityTypes.length > 0
                    ? facilityTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)
                    : (
                      // Fallback static options if API is unavailable
                      <>
                        <option value="1">Restroom</option>
                        <option value="2">Elevator</option>
                        <option value="3">Parking</option>
                        <option value="4">Ramp</option>
                        <option value="5">Tactile Path</option>
                        <option value="6">Braille Signage</option>
                      </>
                    )
                  }
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-floor">Floor level</label>
                <input id="f-floor" value={facility.floor_level} onChange={(e) => setFacility({ ...facility, floor_level: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="f-desc">Location description</label>
                <textarea id="f-desc" rows={2} value={facility.location_description} onChange={(e) => setFacility({ ...facility, location_description: e.target.value })} />
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
            </>
          )}

          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn-secondary" onClick={() => setStep(3)}>Skip</button>
            <button className="btn-primary" disabled={busy || (addFacility && !facility.facility_type)} onClick={addFacility ? handleAddFacility : () => setStep(3)}>
              {busy ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <div className="field">
            <label htmlFor="photo">Photo of this place</label>
            <input id="photo" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
          </div>
          {photoFile && (
            <div className="field">
              <label htmlFor="alt-text">Describe the photo (required for screen readers)</label>
              <input
                id="alt-text"
                required
                placeholder='e.g. "Front entrance of the building with a wheelchair ramp"'
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
              />
            </div>
          )}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn-secondary" onClick={() => navigate(`/places/${createdPlaceId}`)}>Skip</button>
            <button className="btn-primary" disabled={busy || (photoFile && !altText)} onClick={handleUploadPhoto}>
              {busy ? "Uploading…" : "Finish"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
