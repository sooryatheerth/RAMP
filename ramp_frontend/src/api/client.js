import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ramp_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On a 401, try refreshing the access token once, then retry the request.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("ramp_refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post("/api/auth/refresh/", { refresh });
          localStorage.setItem("ramp_access_token", data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.removeItem("ramp_access_token");
          localStorage.removeItem("ramp_refresh_token");
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// --- Endpoint helpers, grouped by resource ---

export const AuthAPI = {
  register: (payload) => api.post("/auth/register/", payload),
  login: (payload) => api.post("/auth/login/", payload),
  me: () => api.get("/auth/me/"),
  updateMe: (payload) => api.patch("/auth/me/", payload),
};

export const PlacesAPI = {
  list: (params) => api.get("/places/", { params }),
  detail: (id) => api.get(`/places/${id}/`),
  create: (payload) => api.post("/places/", payload),
  score: (id) => api.get(`/places/${id}/score/`),
  categories: () => api.get("/place-categories/"),
};

export const AccessPointsAPI = {
  list: (placeId) => api.get(`/places/${placeId}/access-points/`),
  create: (placeId, payload) => api.post(`/places/${placeId}/access-points/`, payload),
  attributes: (placeId, apId) => api.get(`/places/${placeId}/access-points/${apId}/attributes/`),
  submitAttribute: (placeId, apId, payload) =>
    api.post(`/places/${placeId}/access-points/${apId}/attributes/`, payload),
  verifyAttribute: (placeId, apId, attrId, payload) =>
    api.post(`/places/${placeId}/access-points/${apId}/attributes/${attrId}/verify/`, payload),
};

export const FacilitiesAPI = {
  list: (placeId) => api.get(`/places/${placeId}/facilities/`),
  create: (placeId, payload) => api.post(`/places/${placeId}/facilities/`, payload),
};

export const AttributeDefinitionsAPI = {
  list: (params) => api.get("/attribute-definitions/", { params }),
};

export const ImagesAPI = {
  list: (entityType, entityId) =>
    api.get("/images/", { params: { entity_type: entityType, entity_id: entityId } }),
  upload: (formData) =>
    api.post("/images/", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  fileUrl: (id) => `/api/images/${id}/file/`,
  thumbUrl: (id) => `/api/images/${id}/thumb/`,
};

export const FloorPlansAPI = {
  list: (placeId) => api.get(`/places/${placeId}/floor-plans/`),
  upload: (placeId, formData) =>
    api.post(`/places/${placeId}/floor-plans/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  fileUrl: (id) => `/api/floor-plans/${id}/file/`,
  waypoints: (placeId, floorPlanId) =>
    api.get(`/places/${placeId}/floor-plans/${floorPlanId}/waypoints/`),
};

export const PlaceRouteAPI = {
  // Place-wide routing: works across floors, since a Place can have several
  // floor plans linked by VerticalConnections (lift/stairs between floors).
  route: (placeId, payload) => api.post(`/places/${placeId}/route/`, payload),
};

export const WaypointsAPI = {
  scan: (qrCodeValue) => api.get(`/waypoints/scan/${encodeURIComponent(qrCodeValue)}/`),
};

// Geocoding for the "search a location, click the map to add a place" flow.
// Uses OpenStreetMap's Nominatim, consistent with the rest of the stack.
export const GeocodeAPI = {
  search: (query) =>
    axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: query, format: "json", limit: 5 },
    }),
};
