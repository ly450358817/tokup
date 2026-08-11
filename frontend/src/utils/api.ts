import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tokup_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tokup_token');
      window.location.hash = '#/login';
    }
    if (err.response?.status === 402 && localStorage.getItem('tokup_token')) {
      // 余额不足：自动弹出充值窗口（自由充值），减少流失
      window.dispatchEvent(new CustomEvent('tokup:open-recharge'));
    }
    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  register: (email: string, password: string, invite_code?: string, extra?: any) =>
    api.post('/auth/register', { email, password, invite_code, ...extra }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

export const dashboardApi = {
  stats: (days = 7) => api.get(`/dashboard/stats?days=${days}`).then((r) => r.data),
  transactions: (limit = 20) =>
    api.get(`/dashboard/transactions?limit=${limit}`).then((r) => r.data),
};

export const paymentApi = {
  packages: () => api.get('/payment/packages').then((r) => r.data),
  recharge: (pkg: string, method = 'alipay') =>
    api.post('/payment/recharge', { package: pkg, payment_method: method }).then((r) => r.data),
  rechargeAmount: (amount: number, method = 'alipay') =>
    api.post('/payment/recharge', { amount, payment_method: method }).then((r) => r.data),
};

export const keysApi = {
  list: () => api.get('/keys').then((r) => r.data),
  create: (name = '', monthly_cap = 0, daily_cap = 0) => api.post('/keys', { name, monthly_cap, daily_cap }).then((r) => r.data),
  delete: (id: string) => api.delete(`/keys/${id}`).then((r) => r.data),
  batchDelete: (ids: string[]) => api.post('/keys/batch-delete', { ids }).then((r) => r.data),
};

export const monitorApi = {
  stats: () => api.get('/monitor/stats').then((r) => r.data),
};

export const subscriptionApi = {
  plans: () => api.get('/subscription/plans').then((r) => r.data),
  purchase: (planId: string) =>
    api.post(`/subscription/purchase/${planId}`).then((r) => r.data),
  status: () => api.get('/subscription/status').then((r) => r.data),
};
