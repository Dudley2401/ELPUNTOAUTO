import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SignOut, Calendar, ChatCircleText, TrendUp, Trash, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { api, formatApiErrorDetail } from "@/lib/api";

const STATUS_COLOR = {
  new: "bg-[#E10600]/15 text-[#FF6B65] border-[#E10600]/40",
  in_progress: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  completed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-white/10 text-white/60 border-white/15",
  contacted: "bg-sky-500/10 text-sky-300 border-sky-500/30",
};

const APPT_STATUS = ["new", "in_progress", "completed", "cancelled"];
const CONTACT_STATUS = ["new", "contacted", "completed", "cancelled"];

export default function AdminDashboard() {
  const { admin, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [tab, setTab] = useState("appointments");
  const [stats, setStats] = useState({ contacts_total: 0, contacts_new: 0, appointments_total: 0, appointments_new: 0 });
  const [appts, setAppts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, c] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/appointments"),
        api.get("/admin/contacts"),
      ]);
      setStats(s.data); setAppts(a.data); setContacts(c.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  const updateApptStatus = async (id, status) => {
    try {
      await api.patch(`/admin/appointments/${id}`, { status });
      setAppts((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
      toast.success("Updated");
    } catch (e) { toast.error("Failed"); }
  };
  const deleteAppt = async (id) => {
    if (!confirm("Delete?")) return;
    try {
      await api.delete(`/admin/appointments/${id}`);
      setAppts((a) => a.filter((x) => x.id !== id));
      toast.success("Deleted");
    } catch (e) { toast.error("Failed"); }
  };

  const updateContactStatus = async (id, status) => {
    try {
      await api.patch(`/admin/contacts/${id}`, { status });
      setContacts((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
      toast.success("Updated");
    } catch (e) { toast.error("Failed"); }
  };
  const deleteContact = async (id) => {
    if (!confirm("Delete?")) return;
    try {
      await api.delete(`/admin/contacts/${id}`);
      setContacts((a) => a.filter((x) => x.id !== id));
      toast.success("Deleted");
    } catch (e) { toast.error("Failed"); }
  };

  return (
    <div data-testid="admin-dashboard" className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-5 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-white/60 hover:text-white" data-testid="back-home-from-dash">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 grid place-items-center rounded-md bg-[#E10600] font-display">EP</span>
              <div>
                <div className="font-display text-lg tracking-wider leading-none">EL PUNTO</div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">Admin</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-xs text-white/50">{admin?.email}</div>
            <button data-testid="admin-logout" onClick={onLogout} className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white border border-white/10 hover:border-[#E10600] px-3 py-1.5 rounded-full transition">
              <SignOut size={16} /> {t("admin.logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 lg:px-10 py-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Appointments" value={stats.appointments_total} icon={Calendar} />
          <StatCard label="New Appointments" value={stats.appointments_new} icon={TrendUp} accent />
          <StatCard label="Total Messages" value={stats.contacts_total} icon={ChatCircleText} />
          <StatCard label="New Messages" value={stats.contacts_new} icon={TrendUp} accent />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-white/10">
          <TabBtn id="appointments" active={tab === "appointments"} onClick={() => setTab("appointments")} count={appts.length}>
            {t("admin.appointments")}
          </TabBtn>
          <TabBtn id="messages" active={tab === "messages"} onClick={() => setTab("messages")} count={contacts.length}>
            {t("admin.messages")}
          </TabBtn>
        </div>

        {loading ? (
          <div className="py-20 text-center text-white/40 text-sm uppercase tracking-[0.3em]">Loading…</div>
        ) : tab === "appointments" ? (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-[#0F0F10] text-white/50 text-[10px] uppercase tracking-[0.2em]">
                <tr>
                  <Th>{t("admin.client")}</Th>
                  <Th>{t("admin.contactInfo")}</Th>
                  <Th>{t("admin.service")}</Th>
                  <Th>{t("admin.vehicle")}</Th>
                  <Th>{t("admin.datetime")}</Th>
                  <Th>{t("admin.status")}</Th>
                  <Th>{t("admin.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {appts.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-white/40 py-12">{t("admin.empty")}</td></tr>
                ) : appts.map((a) => (
                  <tr key={a.id} data-testid={`appt-row-${a.id}`} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <Td><div className="font-medium">{a.name}</div><div className="text-xs text-white/40">{a.notes || "—"}</div></Td>
                    <Td><div>{a.email}</div><div className="text-xs text-white/40">{a.phone}</div></Td>
                    <Td>{a.service}</Td>
                    <Td>{a.vehicle}</Td>
                    <Td><div>{a.date}</div><div className="text-xs text-white/40">{a.time}</div></Td>
                    <Td>
                      <select
                        data-testid={`appt-status-${a.id}`}
                        value={a.status}
                        onChange={(e) => updateApptStatus(a.id, e.target.value)}
                        className={`text-xs uppercase tracking-wider rounded-full px-3 py-1 border bg-transparent outline-none ${STATUS_COLOR[a.status] || ""}`}
                      >
                        {APPT_STATUS.map((s) => <option key={s} value={s} className="bg-[#111] text-white">{s}</option>)}
                      </select>
                    </Td>
                    <Td>
                      <button data-testid={`appt-delete-${a.id}`} onClick={() => deleteAppt(a.id)} className="text-white/40 hover:text-[#E10600] transition">
                        <Trash size={16} />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-[#0F0F10] text-white/50 text-[10px] uppercase tracking-[0.2em]">
                <tr>
                  <Th>{t("admin.client")}</Th>
                  <Th>{t("admin.contactInfo")}</Th>
                  <Th>{t("admin.message")}</Th>
                  <Th>{t("admin.created")}</Th>
                  <Th>{t("admin.status")}</Th>
                  <Th>{t("admin.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-white/40 py-12">{t("admin.empty")}</td></tr>
                ) : contacts.map((c) => (
                  <tr key={c.id} data-testid={`contact-row-${c.id}`} className="border-t border-white/5 hover:bg-white/[0.02] align-top">
                    <Td>{c.name}</Td>
                    <Td><div>{c.email}</div><div className="text-xs text-white/40">{c.phone}</div></Td>
                    <Td><div className="max-w-md text-white/80 whitespace-pre-wrap">{c.message}</div></Td>
                    <Td className="text-xs text-white/50">{new Date(c.created_at).toLocaleString()}</Td>
                    <Td>
                      <select
                        data-testid={`contact-status-${c.id}`}
                        value={c.status}
                        onChange={(e) => updateContactStatus(c.id, e.target.value)}
                        className={`text-xs uppercase tracking-wider rounded-full px-3 py-1 border bg-transparent outline-none ${STATUS_COLOR[c.status] || ""}`}
                      >
                        {CONTACT_STATUS.map((s) => <option key={s} value={s} className="bg-[#111] text-white">{s}</option>)}
                      </select>
                    </Td>
                    <Td>
                      <button data-testid={`contact-delete-${c.id}`} onClick={() => deleteContact(c.id)} className="text-white/40 hover:text-[#E10600] transition">
                        <Trash size={16} />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "bg-gradient-to-br from-[#E10600]/15 to-transparent border-[#E10600]/30" : "border-white/10 bg-[#0F0F10]"}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">{label}</div>
        <Icon size={18} className={accent ? "text-[#E10600]" : "text-white/40"} />
      </div>
      <div className="mt-3 font-display text-4xl tracking-tight">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children, count, id }) {
  return (
    <button
      data-testid={`tab-${id}`}
      onClick={onClick}
      className={`px-4 py-3 text-sm uppercase tracking-[0.18em] border-b-2 transition ${
        active ? "border-[#E10600] text-white" : "border-transparent text-white/50 hover:text-white"
      }`}
    >
      {children} <span className="ml-2 text-xs text-white/40">{count}</span>
    </button>
  );
}

const Th = ({ children }) => <th className="text-left px-5 py-3 font-medium">{children}</th>;
const Td = ({ children, className = "" }) => <td className={`px-5 py-4 ${className}`}>{children}</td>;
