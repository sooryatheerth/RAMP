import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import jsQR from "jsqr";
import { PlacesAPI, FloorPlansAPI, PlaceRouteAPI, WaypointsAPI } from "../api/client";

/**
 * Checkpoint-based indoor navigation (Option A - see project notes).
 * True continuous GPS-style tracking isn't possible indoors without beacon
 * hardware, so position updates happen at discrete checkpoints: the user
 * taps a waypoint they've physically reached, or scans a QR code posted
 * there. The floor plan + path are drawn as an SVG overlay on the real
 * uploaded floor plan image, using the waypoints' actual pixel coordinates.
 */

function QRScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [scanError, setScanError] = useState("");

  useEffect(() => {
    let animationFrame;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        tick();
      } catch {
        setScanError("Could not access the camera. Check your browser's camera permissions.");
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          onResult(code.data);
          return;
        }
      }
      animationFrame = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancelAnimationFrame(animationFrame);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div style={{ position: "relative", width: "min(90vw, 420px)" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 12 }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
      {scanError && <p style={{ color: "#fff", marginTop: "1rem" }}>{scanError}</p>}
      <p style={{ color: "#fff", marginTop: "1rem" }}>Point your camera at a waypoint QR code</p>
      <button className="btn-secondary" onClick={onClose} style={{ marginTop: "0.5rem" }}>Cancel</button>
    </div>
  );
}

export default function IndoorNav() {
  const { id } = useParams(); // place id
  const [place, setPlace] = useState(null);
  const [floorPlans, setFloorPlans] = useState([]);
  const [activeFloorPlan, setActiveFloorPlan] = useState(null);
  const [allWaypoints, setAllWaypoints] = useState([]); // across every floor of this place
  const [currentWaypointId, setCurrentWaypointId] = useState(null);
  const [destinationId, setDestinationId] = useState("");
  const [route, setRoute] = useState(null);
  const [requireAccessible, setRequireAccessible] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    PlacesAPI.detail(id).then((res) => setPlace(res.data));
    FloorPlansAPI.list(id).then(async (res) => {
      const plans = res.data.results || res.data;
      setFloorPlans(plans);
      if (plans.length > 0) setActiveFloorPlan(plans[0]);

      // Load waypoints for every floor up front, so the destination picker
      // can offer rooms on any floor - routing is place-wide now.
      const perFloor = await Promise.all(
        plans.map((fp) =>
          FloorPlansAPI.waypoints(id, fp.id).then((r) =>
            (r.data.results || r.data).map((w) => ({ ...w, floor_level: fp.floor_level }))
          )
        )
      );
      setAllWaypoints(perFloor.flat());
    }).finally(() => setLoading(false));
  }, [id]);

  const waypoints = allWaypoints.filter((w) => w.floor_plan === activeFloorPlan?.id);

  function switchToFloor(floorPlanId) {
    const fp = floorPlans.find((f) => f.id === floorPlanId);
    if (fp) setActiveFloorPlan(fp);
  }

  async function handleScanResult(qrValue) {
    setShowScanner(false);
    try {
      const { data } = await WaypointsAPI.scan(qrValue);
      if (String(data.place_id) !== String(id)) {
        setError("That QR code belongs to a different building.");
        return;
      }
      if (data.floor_plan_id !== activeFloorPlan?.id) {
        switchToFloor(data.floor_plan_id);
      }
      setCurrentWaypointId(data.id);
      setError("");
    } catch {
      setError("That QR code isn't recognized.");
    }
  }

  async function handleFindRoute() {
    if (!currentWaypointId || !destinationId) return;
    setError("");
    try {
      const { data } = await PlaceRouteAPI.route(id, {
        from_waypoint: currentWaypointId,
        to_waypoint: Number(destinationId),
        require_accessible: requireAccessible,
      });
      setRoute(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not find a route between those points.");
      setRoute(null);
    }
  }

  if (loading) return <main className="container" style={{ padding: "2rem" }}><p className="muted">Loading…</p></main>;
  if (floorPlans.length === 0) {
    return (
      <main className="container" style={{ padding: "2rem" }}>
        <p>No floor plans are available for this place yet.</p>
        <Link to={`/places/${id}`}><button className="btn-secondary">Back to place</button></Link>
      </main>
    );
  }

  const currentWaypoint = allWaypoints.find((w) => w.id === currentWaypointId);
  const currentFloorPathWaypoints = (route?.path || []).filter((w) => w.floor_plan === activeFloorPlan?.id);
  const pathIds = currentFloorPathWaypoints.map((w) => w.id);
  const points = currentFloorPathWaypoints.map((w) => `${w.x},${w.y}`).join(" ");
  const routeFloorLevels = route
    ? [...new Set(route.path.map((w) => allWaypoints.find((aw) => aw.id === w.id)?.floor_level).filter(Boolean))]
    : [];

  return (
    <main className="container" style={{ padding: "2rem 1.25rem", maxWidth: 900 }}>
      <h1>Navigate inside — {place?.name}</h1>

      {floorPlans.length > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          {floorPlans.map((fp) => (
            <button
              key={fp.id}
              className={fp.id === activeFloorPlan?.id ? "btn-primary" : "btn-secondary"}
              onClick={() => switchToFloor(fp.id)}
            >
              {fp.floor_level}
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.8rem" }}>
          <div>
            <strong>Your position: </strong>
            {currentWaypoint ? currentWaypoint.label : <span className="muted">Not set</span>}
          </div>
          <button className="btn-primary" onClick={() => setShowScanner(true)}>Scan QR to check in</button>
        </div>
        <p className="muted" style={{ fontSize: "0.85rem", margin: "0.5em 0 0" }}>
          Or tap a marker on the floor plan below to manually set your position.
        </p>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      <div style={{ position: "relative", width: "100%", marginBottom: "1rem" }}>
        <img
          src={FloorPlansAPI.fileUrl(activeFloorPlan.id)}
          alt={`Floor plan - ${activeFloorPlan.floor_level} floor`}
          style={{ width: "100%", display: "block", borderRadius: "var(--radius)", border: "1px solid var(--color-border)" }}
        />
        <svg
          viewBox={`0 0 ${activeFloorPlan.width_px} ${activeFloorPlan.height_px}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          {route && (
            <polyline points={points} fill="none" stroke="#0F6E56" strokeWidth={activeFloorPlan.width_px / 250} strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
          )}
          {waypoints.map((wp) => {
            const isCurrent = wp.id === currentWaypointId;
            const onPath = pathIds.includes(wp.id);
            const r = activeFloorPlan.width_px / 130;
            return (
              <g key={wp.id} style={{ cursor: "pointer" }} onClick={() => setCurrentWaypointId(wp.id)}>
                <circle
                  cx={wp.x} cy={wp.y} r={isCurrent ? r * 1.6 : r}
                  fill={isCurrent ? "#1D6FE0" : onPath ? "#0F6E56" : "#99521D"}
                  stroke="white" strokeWidth={r / 4}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="destination">Navigate to</label>
          <select id="destination" value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
            <option value="">Select a destination</option>
            {allWaypoints.filter((w) => w.id !== currentWaypointId).map((w) => (
              <option key={w.id} value={w.id}>{w.label} — {w.floor_level} floor ({w.waypoint_type})</option>
            ))}
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5em", fontWeight: 400, marginBottom: "1em" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={requireAccessible} onChange={(e) => setRequireAccessible(e.target.checked)} />
          Wheelchair-accessible route only (still shown if not fully possible, with warnings)
        </label>
        <button className="btn-primary" disabled={!currentWaypointId || !destinationId} onClick={handleFindRoute}>
          Find route
        </button>

        {route && (
          <div style={{ marginTop: "1rem" }}>
            <p>
              <strong>{route.total_distance_meters}m</strong> ·{" "}
              <span className={`confidence-badge ${route.accessibility_confidence_score >= 75 ? "high" : route.accessibility_confidence_score >= 40 ? "medium" : "low"}`}>
                <span className="dot" aria-hidden="true" />
                {route.accessibility_confidence_score}% accessible
              </span>
            </p>
            {route.crosses_floors && (
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                This route continues across floors: {routeFloorLevels.join(" → ")}. Switch floor tabs above to see each section, or check in again once you've taken the lift/stairs.
              </p>
            )}
            {route.warnings.length > 0 && (
              <ul style={{ marginTop: "0.5em" }}>
                {route.warnings.map((w) => (
                  <li key={`${w.edge_kind}-${w.edge_id}`} className="muted" style={{ fontSize: "0.9rem" }}>
                    ⚠️ {w.from} → {w.to}: {w.issue}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {showScanner && <QRScanner onResult={handleScanResult} onClose={() => setShowScanner(false)} />}
    </main>
  );
}
