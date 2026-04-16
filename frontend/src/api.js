import axios from 'axios';
import { db } from './db';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('token');
      if (token) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const isOnline = () => navigator.onLine;

export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  changePassword: async (email, currentPassword, newPassword) => {
    const response = await api.post('/auth/change-password', { email, currentPassword, newPassword });
    return response.data;
  },
};

export const formsAPI = {
  getAll: async (category = null, isActive = true) => {
    if (!isOnline()) {
      let forms = await db.forms.toArray();
      if (category) forms = forms.filter(f => f.category === category);
      if (isActive !== null) forms = forms.filter(f => f.is_active === isActive);
      return forms;
    }
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (isActive !== null) params.append('isActive', isActive);
    const response = await api.get(`/forms?${params.toString()}`);
    return response.data;
  },
  getById: async (id) => {
    if (!isOnline()) return await db.forms.get({ syncId: id });
    const response = await api.get(`/forms/${id}`);
    return response.data;
  },
  create: async (formData) => { const response = await api.post('/forms', formData); return response.data; },
  update: async (id, formData) => { const response = await api.put(`/forms/${id}`, formData); return response.data; },
  delete: async (id) => { const response = await api.delete(`/forms/${id}`); return response.data; },
};

export const inspectionsAPI = {
  getAll: async (filters = {}) => {
    if (!isOnline()) {
      let inspections = await db.inspections.toArray();
      if (filters.status) inspections = inspections.filter(i => i.status === filters.status);
      if (filters.templateId) inspections = inspections.filter(i => i.template_id === filters.templateId);
      return inspections;
    }
    const params = new URLSearchParams(filters);
    const response = await api.get(`/inspections?${params.toString()}`);
    return response.data;
  },
  getById: async (id) => {
    if (!isOnline()) {
      const inspection = await db.inspections.get(id);
      if (inspection) {
        inspection.photos = await db.photos
          .where('inspectionSyncId').equals(inspection.syncId).sortBy('sequenceOrder');
      }
      return inspection;
    }
    const response = await api.get(`/inspections/${id}`);
    return response.data;
  },
  create: async (inspectionData) => {
    if (!isOnline()) return await db.createOfflineInspection(inspectionData);
    const response = await api.post('/inspections', inspectionData);
    return response.data;
  },
  update: async (id, inspectionData) => {
    if (!isOnline()) {
      await db.inspections.update(id, { ...inspectionData, updatedAt: new Date().toISOString(), synced: false });
      return { id, ...inspectionData };
    }
    const response = await api.put(`/inspections/${id}`, inspectionData);
    return response.data;
  },
  review: async (id, status, comments) => {
    const response = await api.post(`/inspections/${id}/review`, { status, comments });
    return response.data;
  },
  delete: async (id) => {
    if (!isOnline()) { await db.inspections.delete(id); return { message: 'Deleted locally' }; }
    const response = await api.delete(`/inspections/${id}`);
    return response.data;
  },
  getStats: async () => { const response = await api.get('/inspections/stats/summary'); return response.data; },
};

export const syncAPI = {
  syncInspections: async () => {
    if (!isOnline()) throw new Error('Cannot sync while offline');
    const unsyncedInspections = await db.getUnsyncedInspections();
    if (unsyncedInspections.length === 0) return { success: [], failed: [], totalSynced: 0 };
    const response = await api.post('/sync/inspections', { inspections: unsyncedInspections });
    for (const success of response.data.success) {
      await db.markInspectionSynced(success.syncId, success.serverId);
    }
    return response.data;
  },
  downloadOfflineData: async () => {
    const response = await api.get('/sync/download');
    await db.initializeOfflineData(response.data);
    return response.data;
  },
  getSyncHistory: async () => { const response = await api.get('/sync/history'); return response.data; },
};

export const usersAPI = {
  getAll: async () => { const response = await api.get('/users'); return response.data; },
  create: async (userData) => { const response = await api.post('/users', userData); return response.data; },
  update: async (id, userData) => { const response = await api.put(`/users/${id}`, userData); return response.data; },
  delete: async (id) => { const response = await api.delete(`/users/${id}`); return response.data; },
  changePassword: async (id, newPassword) => { const response = await api.put(`/users/${id}/password`, { newPassword }); return response.data; },
  getProfile: async () => { const response = await api.get('/users/me'); return response.data; },
};

export const systemAPI = {
  getAuditLogs: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await api.get(`/system/audit-logs?${params.toString()}`);
    return response.data;
  },
  getStats: async () => { const response = await api.get('/system/stats'); return response.data; },
  convertPdfForm: async (base64Data) => {
    const response = await api.post('/system/convert-pdf-form', { pdfBase64: base64Data });
    return response.data;
  },
};

export const capaAPI = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await api.get(`/capa?${params.toString()}`);
    return response.data;
  },
  create: async (data) => { const response = await api.post('/capa', data); return response.data; },
  update: async (id, data) => { const response = await api.put(`/capa/${id}`, data); return response.data; },
  delete: async (id) => { const response = await api.delete(`/capa/${id}`); return response.data; },
  getStats: async () => { const response = await api.get('/capa/stats'); return response.data; },
};

export const schedulesAPI = {
  getAll: async () => { const response = await api.get('/schedules'); return response.data; },
  getById: async (id) => { const response = await api.get(`/schedules/${id}`); return response.data; },
  create: async (data) => { const response = await api.post('/schedules', data); return response.data; },
  update: async (id, data) => { const response = await api.put(`/schedules/${id}`, data); return response.data; },
  delete: async (id) => { const response = await api.delete(`/schedules/${id}`); return response.data; },
  start: async (id) => { const response = await api.post(`/schedules/${id}/start`); return response.data; },
  complete: async (id) => { const response = await api.put(`/schedules/${id}`, { status: 'completed' }); return response.data; },
  cancelStart: async (id) => { const response = await api.post(`/schedules/${id}/cancel`); return response.data; },
};

export const rfiAPI = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await api.get(`/rfi?${params.toString()}`);
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/rfi/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/rfi', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/rfi/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/rfi/${id}`);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/rfi/stats');
    return response.data;
  },
};

export const projectsAPI = {
  getAll: async () => {
    const response = await api.get('/projects');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/projects', data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },
};

export const uploadAPI = {
  upload: async (file, folder = 'rfi') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  delete: async (key) => {
    const response = await api.delete('/upload', { data: { key } });
    return response.data;
  },
};

export default api;
