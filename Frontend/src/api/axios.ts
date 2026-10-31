// =================================================================
// Cliente Axios con interceptor de JWT
// Cada petición agrega automáticamente el token al header
// =================================================================
import axios from 'axios';

const API_URL = 'http://localhost:3000';

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor: agrega el token JWT a cada request automáticamente
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('carenest_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor de respuesta: si el token expira (401), redirige al login
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('carenest_token');
            localStorage.removeItem('carenest_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    },
);