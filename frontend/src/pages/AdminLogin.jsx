import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LockKey, EnvelopeSimple, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, admin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (admin && admin.role === "admin") navigate("/admin", { replace: true });
  }, [admin, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) {
      toast.success("Welcome back");
      navigate("/admin", { replace: true });
    } else {
      setErr("Credenciales inválidas / Invalid credentials");
    }
  };

  return (
    <div data-testid="admin-login-page" className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-white px-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#E10600] blur-[180px] opacity-20" />
      <Link to="/" className="absolute top-6 left-6 text-sm text-white/60 hover:text-white inline-flex items-center gap-2" data-testid="back-home-link">
        <ArrowLeft size={16} /> Home
      </Link>

      <form
        data-testid="admin-login-form"
        onSubmit={submit}
        className="relative w-full max-w-md p-8 rounded-2xl border border-white/10 bg-[#0F0F10] glow-ring"
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 grid place-items-center rounded-md bg-[#E10600] font-display text-xl">EP</span>
          <div>
            <div className="font-display text-xl tracking-wider">EL PUNTO</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">Admin Console</div>
          </div>
        </div>
        <h1 className="font-display text-3xl mt-6 mb-2">Iniciar Sesión</h1>
        <p className="text-white/50 text-sm mb-6">Acceso solo para administradores autorizados.</p>

        <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2 block">Email</label>
        <div className="relative mb-4">
          <EnvelopeSimple size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            data-testid="admin-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg pl-10 pr-4 py-3 text-sm"
          />
        </div>

        <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2 block">Password</label>
        <div className="relative mb-6">
          <LockKey size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            data-testid="admin-password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg pl-10 pr-4 py-3 text-sm"
          />
        </div>

        {err ? <div data-testid="admin-login-error" className="mb-4 text-sm text-[#FF4F47]">{err}</div> : null}

        <button
          data-testid="admin-login-submit"
          type="submit"
          disabled={loading}
          className="w-full btn-red rounded-full text-white font-medium py-3 text-sm uppercase tracking-[0.2em] disabled:opacity-60"
        >
          {loading ? "…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
