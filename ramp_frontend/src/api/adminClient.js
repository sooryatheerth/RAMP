/**
 * Admin API helpers – all endpoints require is_staff=True (IsAdminUser).
 * The axios instance from client.js already attaches the JWT token.
 */
import api from "./client";

export const AdminAPI = {
  stats: () => api.get("/admin/stats/"),
};

export const AdminUsersAPI = {
  list: (params) => api.get("/admin/users/", { params }),
  detail: (id) => api.get(`/admin/users/${id}/`),
  update: (id, payload) => api.patch(`/admin/users/${id}/`, payload),
  delete: (id) => api.delete(`/admin/users/${id}/`),
};

export const AdminVenuesAPI = {
  list: (params) => api.get("/admin/venues/", { params }),
  detail: (id) => api.get(`/admin/venues/${id}/`),
  approve: (id) => api.post(`/admin/venues/${id}/approve/`),
  reject: (id) => api.post(`/admin/venues/${id}/reject/`),
  delete: (id) => api.delete(`/admin/venues/${id}/`),
};

export const AdminPlacesAPI = {
  list: (params) => api.get("/admin/places/", { params }),
  detail: (id) => api.get(`/admin/places/${id}/`),
  update: (id, payload) => api.patch(`/admin/places/${id}/`, payload),
  delete: (id) => api.delete(`/admin/places/${id}/`),
};

export const AdminPlaceCategoriesAPI = {
  list: () => api.get("/admin/place-categories/"),
  create: (payload) => api.post("/admin/place-categories/", payload),
  update: (id, payload) => api.patch(`/admin/place-categories/${id}/`, payload),
  delete: (id) => api.delete(`/admin/place-categories/${id}/`),
};

export const AdminFacilityTypesAPI = {
  list: () => api.get("/admin/facility-types/"),
  create: (payload) => api.post("/admin/facility-types/", payload),
  update: (id, payload) => api.patch(`/admin/facility-types/${id}/`, payload),
  delete: (id) => api.delete(`/admin/facility-types/${id}/`),
};

export const AdminAccessibilityProfilesAPI = {
  list: () => api.get("/admin/accessibility-profiles/"),
  create: (payload) => api.post("/admin/accessibility-profiles/", payload),
  update: (id, payload) => api.patch(`/admin/accessibility-profiles/${id}/`, payload),
  delete: (id) => api.delete(`/admin/accessibility-profiles/${id}/`),
};

export const AdminAttributeDefinitionsAPI = {
  list: (params) => api.get("/admin/attribute-definitions/", { params }),
  create: (payload) => api.post("/admin/attribute-definitions/", payload),
  update: (id, payload) => api.patch(`/admin/attribute-definitions/${id}/`, payload),
  delete: (id) => api.delete(`/admin/attribute-definitions/${id}/`),
};

export const AdminAttributeVerificationsAPI = {
  list: (params) => api.get("/admin/attribute-verifications/", { params }),
};

export const AdminImagesAPI = {
  list: (params) => api.get("/admin/images/", { params }),
  verify: (id) => api.post(`/admin/images/${id}/verify/`),
  flag: (id, reason = "") => api.post(`/admin/images/${id}/flag/`, { reason }),
  remove: (id) => api.post(`/admin/images/${id}/remove/`),
  delete: (id) => api.delete(`/admin/images/${id}/`),
};

export const AdminSystemConfigAPI = {
  list: () => api.get("/admin/system-config/"),
  update: (id, payload) => api.patch(`/admin/system-config/${id}/`, payload),
  create: (payload) => api.post("/admin/system-config/", payload),
  delete: (id) => api.delete(`/admin/system-config/${id}/`),
};
