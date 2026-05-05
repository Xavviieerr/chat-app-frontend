import api from "./axios";

export const register = (data) => api.post("/auth/register", data);

export const login = (data) => {
	console.log("🔓 API: Attempting login for", data.username);
	return api.post("/auth/login", data);
};

export const getMe = () => api.get("/auth/me");

export const refreshToken = (token) =>
	api.post("/auth/refresh", { refresh_token: token });

export const logout = (token) =>
	api.post("/auth/logout", { refresh_token: token });
