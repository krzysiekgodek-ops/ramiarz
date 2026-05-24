import axios from "axios";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Interceptor odświeża token jeśli wygasł w trakcie sesji (po 1h)
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken(false);
      config.headers.Authorization = `Bearer ${token}`;
    } catch (_) {}
  }
  return config;
});

// Wyloguj tylko gdy backend potwierdzi że TOKEN jest zły (nie "brak tokenu")
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const detail = err?.response?.data?.detail ?? "";
    const isTokenError = err?.response?.status === 401
      && detail !== "Not authenticated"
      && auth.currentUser;
    if (isTokenError) {
      console.warn("Token wygasł — automatyczne wylogowanie");
      await signOut(auth).catch(() => {});
    }
    return Promise.reject(err);
  }
);

export default api;
