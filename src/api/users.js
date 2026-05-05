import api from "./axios";

export const searchUsers = (query) => api.get(`/users/search?q=${query}`);
export const getUserPublicKey = (userId) => api.get(`/users/${userId}/public-key`);
