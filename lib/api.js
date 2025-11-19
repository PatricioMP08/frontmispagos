import axios from "axios";

const api = axios.create({
  baseURL: "https://apimisgastos.onrender.com/api", // URL de tu backend en Render
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
