import axios from "axios";

const api = axios.create({
	baseURL: "https://whisperbox.koyeb.app",
	headers: {
		"Content-Type": "application/json",
	},
});

// Request interceptor to add access token
api.interceptors.request.use((config) => {
	const token = localStorage.getItem("access_token");
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;

		// Don't try to refresh if it's already an auth endpoint failing
		const isAuthEndpoint = 
			originalRequest.url.includes("/auth/login") || 
			originalRequest.url.includes("/auth/register") || 
			originalRequest.url.includes("/auth/refresh");

		// If error is 401 and not already retrying and not an auth endpoint
		if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
			originalRequest._retry = true;

			try {
				const refreshToken = localStorage.getItem("refresh_token");
				if (!refreshToken) throw new Error("No refresh token available");

				const response = await axios.post("https://whisperbox.koyeb.app/auth/refresh", {
					refresh_token: refreshToken,
				});

				const { access_token } = response.data;
				localStorage.setItem("access_token", access_token);

				originalRequest.headers.Authorization = `Bearer ${access_token}`;
				return api(originalRequest);
			} catch (refreshError) {
				// Refresh failed, logout user
				localStorage.removeItem("access_token");
				localStorage.removeItem("refresh_token");
				// Use window.location.pathname to check if we're already on /login to avoid loops
				if (window.location.pathname !== "/login") {
					window.location.href = "/login";
				}
				return Promise.reject(refreshError);
			}
		}

		return Promise.reject(error);
	},
);

export default api;
