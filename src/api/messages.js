import api from "./axios";

export const getConversations = () => api.get("/conversations");
export const getMessages = (userId, params) => api.get(`/conversations/${userId}/messages`, { params });
export const sendMessage = (data) => api.post("/messages", data);
