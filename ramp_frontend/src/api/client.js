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
  changePassword: (payload) => api.post("/auth/change-password/", payload),
  myPlaces: () => api.get("/auth/my-places/"),
  myAttributes: () => api.get("/auth/my-attributes/"),
};

export const PlacesAPI = {
  list: (params) => api.get("/places/", { params }),
  detail: (id) => api.get(`/places/${id}/`),
  create: (payload) => api.post("/places/", payload),
  update: (id, payload) => api.patch(`/places/${id}/`, payload),
  delete: (id) => api.delete(`/places/${id}/`),
  score: (id) => api.get(`/places/${id}/score/`),
  categories: () => api.get("/place-categories/"),
  nearby: (lat, lng, radius = 50) =>
    api.get("/places/nearby/", { params: { lat, lng, radius } }),
};

export const FacilityTypesAPI = {
  list: () => api.get("/facility-types/"),
};

export const AccessPointsAPI = {
  list: (placeId) => api.get(`/places/${placeId}/access-points/`),
  create: (placeId, payload) => api.post(`/places/${placeId}/access-points/`, payload),
  update: (placeId, apId, payload) => api.patch(`/places/${placeId}/access-points/${apId}/`, payload),
  delete: (placeId, apId) => api.delete(`/places/${placeId}/access-points/${apId}/`),
  attributes: (placeId, apId) => api.get(`/places/${placeId}/access-points/${apId}/attributes/`),
  submitAttribute: (placeId, apId, payload) =>
    api.post(`/places/${placeId}/access-points/${apId}/attributes/`, payload),
  verifyAttribute: (placeId, apId, attrId, payload) =>
    api.post(`/places/${placeId}/access-points/${apId}/attributes/${attrId}/verify/`, payload),
};

export const FacilitiesAPI = {
  list: (placeId) => api.get(`/places/${placeId}/facilities/`),
  create: (placeId, payload) => api.post(`/places/${placeId}/facilities/`, payload),
  update: (placeId, facId, payload) => api.patch(`/places/${placeId}/facilities/${facId}/`, payload),
  delete: (placeId, facId) => api.delete(`/places/${placeId}/facilities/${facId}/`),
  attributes: (placeId, facId) => api.get(`/places/${placeId}/facilities/${facId}/attributes/`),
  submitAttribute: (placeId, facId, payload) =>
    api.post(`/places/${placeId}/facilities/${facId}/attributes/`, payload),
  verifyAttribute: (placeId, facId, attrId, payload) =>
    api.post(`/places/${placeId}/facilities/${facId}/attributes/${attrId}/verify/`, payload),
};

export const AttributeDefinitionsAPI = {
  list: (params) => api.get("/attribute-definitions/", { params }),
};

export const ImagesAPI = {
  list: (entityType, entityId) =>
    api.get("/images/", { params: { entity_type: entityType, entity_id: entityId } }),
  upload: (formData) =>
    api.post("/images/", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  delete: (id) => api.delete(`/images/${id}/`),
  fileUrl: (id) => `/api/images/${id}/file/`,
  thumbUrl: (id) => `/api/images/${id}/thumb/`,
};

export const GeocodeAPI = {
  search: (query) =>
    axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: query, format: "json", limit: 5 },
    }),
};

export const GamificationAPI = {
  badges: () => api.get("/badges/"),
  myBadges: () => api.get("/badges/my/"),
  milestones: () => api.get("/badges/milestones/"),
  tiers: () => api.get("/badges/tiers/"),
  leaderboard: (params) => api.get("/leaderboard/", { params }),
};
