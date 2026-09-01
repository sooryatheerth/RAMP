import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  PlacesAPI, AccessPointsAPI, FacilitiesAPI,
  AttributeDefinitionsAPI, ImagesAPI,
} from "../api/client";

const STEPS = ["Place details", "Main entrance", "Facilities (optional)", "Photo (optional)"];

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
    name: "", category: "", description: "", address: "", city: "",
    lat: prefilled?.lat ?? "", lng: prefilled?.lng ?? "",
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

  // Step 4: photo (of the place itself)
  const [photoFile, setPhotoFile] = useState(null);
  const [altText, setAltText] = useState("");

  // Created ids, filled in as we go
  const [createdPlaceId, setCreatedPlaceId] = useState(null);
  const [createdAccessPointId, setCreatedAccessPointId] = useState(null);

  useEffect(() => {
    PlacesAPI.categories().then((res) => setCategories(res.data.results || res.data));
    AttributeDefinitionsAPI.list({ applies_to: "access_point" }).then((res) =>
      setAttributeDefs(res.data.results || res.data)
    );
  }, []);

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

  return (
    <main className="container" style={{ padding: "2rem 1.25rem", maxWidth: 560 }}>
      <h1>Add a place</h1>
      <p className="muted">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {error && <p className="error-text" role="alert">{error}</p>}

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
                  <input id="p-lat" required type="number" step="any" value={place.lat} onChange={(e) => setPlace({ ...place, lat: e.target.value })} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="p-lng">Longitude</label>
                  <input id="p-lng" required type="number" step="any" value={place.lng} onChange={(e) => setPlace({ ...place, lng: e.target.value })} />
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
                  <option value="1">Restroom</option>
                  <option value="2">Elevator</option>
                  <option value="3">Parking</option>
                  <option value="4">Ramp</option>
                  <option value="5">Tactile Path</option>
                  <option value="6">Braille Signage</option>
                </select>
                <p className="muted" style={{ fontSize: "0.8rem" }}>
                  (Loaded from your seeded facility types — IDs may vary; swap this for a live fetch in production.)
                </p>
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
