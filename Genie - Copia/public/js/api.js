const API = (() => {
  const BASE_URL = '/api';

  const getToken = () => localStorage.getItem('genie_token');
  const setToken = (token) => localStorage.setItem('genie_token', token);
  const removeToken = () => localStorage.removeItem('genie_token');
  
  const getUsuario = () => {
    const userStr = localStorage.getItem('genie_usuario');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  };
  const setUsuario = (usuario) => localStorage.setItem('genie_usuario', JSON.stringify(usuario));
  const removeUsuario = () => localStorage.removeItem('genie_usuario');

  const request = async (endpoint, options = {}) => {
    const url = `${BASE_URL}${endpoint}`;
    
    // Set headers
    const headers = options.headers || {};
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Set body if it's not a FormData instance
    let body = options.body;
    if (body && !(body instanceof FormData) && typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    const fetchOptions = {
      ...options,
      headers,
      body
    };

    try {
      const response = await fetch(url, fetchOptions);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // If JWT token expired or is invalid, logout immediately
        if (response.status === 401) {
          logout();
          window.location.hash = '#login';
          throw new Error(data.error || 'Sessão expirada. Faça login novamente.');
        }
        throw new Error(data.error || 'Erro na requisição ao servidor.');
      }

      return data;
    } catch (error) {
      console.error(`API Error on ${endpoint}:`, error.message);
      throw error;
    }
  };

  const logout = () => {
    removeToken();
    removeUsuario();
  };

  return {
    getToken,
    setToken,
    removeToken,
    getUsuario,
    setUsuario,
    removeUsuario,
    logout,
    get: (endpoint, headers) => request(endpoint, { method: 'GET', headers }),
    post: (endpoint, body, headers) => request(endpoint, { method: 'POST', body, headers }),
    put: (endpoint, body, headers) => request(endpoint, { method: 'PUT', body, headers }),
    patch: (endpoint, body, headers) => request(endpoint, { method: 'PATCH', body, headers }),
    delete: (endpoint, headers) => request(endpoint, { method: 'DELETE', headers }),
    isLoggedIn: () => !!getToken()
  };
})();
