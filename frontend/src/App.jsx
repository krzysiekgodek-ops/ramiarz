import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import LoginPage      from "./pages/LoginPage";
import CalculatorPage from "./pages/CalculatorPage";
import MouldingsPage  from "./pages/MouldingsPage";
import OrdersPage     from "./pages/OrdersPage";
import SettingsPage   from "./pages/SettingsPage";
import AdminPage      from "./pages/AdminPage";
import Navbar         from "./components/layout/Navbar";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }) {
  const { firebaseUser, dbUser, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (adminOnly && !dbUser?.is_superadmin) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { firebaseUser } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={firebaseUser ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Navbar /><CalculatorPage /></ProtectedRoute>} />
      <Route path="/cenniki" element={<ProtectedRoute><Navbar /><MouldingsPage /></ProtectedRoute>} />
      <Route path="/zlecenia" element={<ProtectedRoute><Navbar /><OrdersPage /></ProtectedRoute>} />
      <Route path="/ustawienia" element={<ProtectedRoute><Navbar /><SettingsPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><Navbar /><AdminPage /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
