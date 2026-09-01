import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import L from "leaflet";

// Leaflet's default marker icons don't resolve correctly through bundlers -
// point them at the CDN copies explicitly.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Distinct icon (teal, larger) for the "you clicked here / add this place"
// candidate pin, so it's visually unambiguous from existing verified places.
const candidateIcon = L.divIcon({
  className: "",
  html: `<div style="
    width: 26px; height: 26px; border-radius: 50% 50% 50% 0;
    background: #0F6E56; border: 3px solid white; transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

/** Handles map clicks and reports the clicked lat/lng up to the parent. */
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng);
    },
  });
  return null;
}

/** Recenters the map imperatively when `flyToCenter` changes (e.g. after a search). */
function FlyToController({ flyToCenter }) {
  const map = useMap();
  useEffect(() => {
    if (flyToCenter) {
      map.flyTo(flyToCenter, 17, { duration: 1 });
    }
  }, [flyToCenter, map]);
  return null;
}

export default function PlacesMap({
  places,
  center = [11.05, 76.08],
  zoom = 13,
  onMapClick,
  candidatePosition,
  flyToCenter,
  height = "420px",
}) {
  return (
    <div style={{ borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--color-border)" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height, width: "100%" }}
        aria-label="Map of accessible places"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onMapClick={onMapClick} />
        <FlyToController flyToCenter={flyToCenter} />

        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.primary_location.lat, place.primary_location.lng]}
            icon={defaultIcon}
          >
            <Popup>
              <strong>{place.name}</strong>
              <br />
              <span className="muted">{place.category_name}</span>
              <br />
              <Link to={`/places/${place.id}`}>View details</Link>
            </Popup>
          </Marker>
        ))}

        {candidatePosition && (
          <Marker position={[candidatePosition.lat, candidatePosition.lng]} icon={candidateIcon} />
        )}
      </MapContainer>
    </div>
  );
}
