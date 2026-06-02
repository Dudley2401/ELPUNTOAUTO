import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Home from "@/pages/Home";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import "@/App.css";

function ProtectedRoute({ children }) {
  const { admin } = useAuth();
  if (admin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-white">
        <div className="text-sm tracking-widest uppercase opacity-60">Loading…</div>
      </div>
    );
  }
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}

function App() {
  useEffect(() => { document.title = "El Punto Autoservices — Santo Domingo"; }, []);
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster theme="dark" position="top-center" richColors />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
