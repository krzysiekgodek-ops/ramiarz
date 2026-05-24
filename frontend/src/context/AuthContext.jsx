import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [dbUser, setDbUser]             = useState(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Pobierz token PRZED setFirebaseUser — strony nie wyrenderują się bez tokenu
        try {
          const token = await fbUser.getIdToken();
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        } catch (_) {}
        setFirebaseUser(fbUser);
        try {
          const { data } = await api.get("/auth/me");
          setDbUser(data);
        } catch (err) {
          console.warn("Backend /auth/me error:", err?.response?.status, err?.response?.data, err?.message);
          setDbUser(null);
        }
      } else {
        delete api.defaults.headers.common["Authorization"];
        setFirebaseUser(null);
        setDbUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, dbUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
