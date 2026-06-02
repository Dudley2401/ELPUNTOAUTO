import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  SignOut, Calendar, ChatCircleText, TrendUp, Trash, ArrowLeft, Wrench, Plus, PencilSimple, X, Check, Receipt,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import InvoiceModal from "@/components/InvoiceModal";

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
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceFor, setInvoiceFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, c, te] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/appointments"),
        api.get("/admin/contacts"),
        api.get("/admin/technicians"),
      ]);
      setStats(s.data); setAppts(a.data); setContacts(c.data); setTechs(te.data);
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
      toast.success("Estado actualizado");
    } catch (e) { toast.error("Error"); }
  };

  const deleteAppt = async (id) => {
    if (!confirm("¿Eliminar esta cita?")) return;
    try {
      await api.delete(`/admin/appointments/${id}`);
      setAppts((a) => a.filter((x) => x.id !== id));
      toast.success("Eliminada");
    } catch (e) { toast.error("Error"); }
  };

  const assignTech = async (appt_id, technician_id) => {
    try {
      const { data } = await api.patch(`/admin/appointments/${appt_id}/assign`, { technician_id: technician_id || null });
      setAppts((a) => a.map((x) => (x.id === appt_id ? { ...x, technician_id: data.technician_id, technician_name: data.technician_name } : x)));
      toast.success(technician_id ? "Técnico asignado" : "Asignación removida");
    } catch (e) { toast.error("Error"); }
  };

  const updateContactStatus = async (id, status) => {
    try {
      await api.patch(`/admin/contacts/${id}`, { status });
      setContacts((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
      toast.success("Actualizado");
    } catch (e) { toast.error("Error"); }
  };
  const deleteContact = async (id) => {
    if (!confirm("¿Eliminar este mensaje?")) return;
    try {
      await api.delete(`/admin/contacts/${id}`);
      setContacts((a) => a.filter((x) => x.id !== id));
      toast.success("Eliminado");
    } catch (e) { toast.error("Error"); }
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
          <StatCard label="Total Citas" value={stats.appointments_total} icon={Calendar} />
          <StatCard label="Citas Nuevas" value={stats.appointments_new} icon={TrendUp} accent />
          <StatCard label="Mensajes" value={stats.contacts_total} icon={ChatCircleText} />
          <StatCard label="Técnicos" value={techs.length} icon={Wrench} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-white/10 overflow-x-auto">
          <TabBtn id="appointments" active={tab === "appointments"} onClick={() => setTab("appointments")} count={appts.length}>
            {t("admin.appointments")}
          </TabBtn>
          <TabBtn id="messages" active={tab === "messages"} onClick={() => setTab("messages")} count={contacts.length}>
            {t("admin.messages")}
          </TabBtn>
          <TabBtn id="technicians" active={tab === "technicians"} onClick={() => setTab("technicians")} count={techs.length}>
            Técnicos
          </TabBtn>
        </div>

        {loading ? (
          <div className="py-20 text-center text-white/40 text-sm uppercase tracking-[0.3em]">Loading…</div>
        ) : tab === "appointments" ? (
          <AppointmentsTable appts={appts} techs={techs} onStatus={updateApptStatus} onDelete={deleteAppt} onAssign={assignTech} onInvoice={setInvoiceFor} t={t} />
        ) : tab === "messages" ? (
          <MessagesTable contacts={contacts} onStatus={updateContactStatus} onDelete={deleteContact} t={t} />
        ) : (
          <TechniciansPanel techs={techs} onChanged={load} />
        )}
      </main>

      {invoiceFor && (
        <InvoiceModal
          appointment={invoiceFor}
          onClose={() => setInvoiceFor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function AppointmentsTable({ appts, techs, onStatus, onDelete, onAssign, onInvoice, t }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-sm min-w-[1100px]">
        <thead className="bg-[#0F0F10] text-white/50 text-[10px] uppercase tracking-[0.2em]">
          <tr>
            <Th>{t("admin.client")}</Th>
            <Th>{t("admin.contactInfo")}</Th>
            <Th>{t("admin.service")}</Th>
            <Th>{t("admin.vehicle")}</Th>
            <Th>{t("admin.datetime")}</Th>
            <Th>Técnico</Th>
            <Th>{t("admin.status")}</Th>
            <Th>{t("admin.actions")}</Th>
          </tr>
        </thead>
        <tbody>
          {appts.length === 0 ? (
            <tr><td colSpan={8} className="text-center text-white/40 py-12">{t("admin.empty")}</td></tr>
          ) : appts.map((a) => (
            <tr key={a.id} data-testid={`appt-row-${a.id}`} className="border-t border-white/5 hover:bg-white/[0.02]">
              <Td><div className="font-medium">{a.name}</div><div className="text-xs text-white/40 max-w-[180px] truncate">{a.notes || "—"}</div></Td>
              <Td><div>{a.email}</div><div className="text-xs text-white/40">{a.phone}</div></Td>
              <Td>{a.service}</Td>
              <Td>{a.vehicle}</Td>
              <Td><div>{a.date}</div><div className="text-xs text-white/40">{a.time}</div></Td>
              <Td>
                <select
                  data-testid={`appt-tech-${a.id}`}
                  value={a.technician_id || ""}
                  onChange={(e) => onAssign(a.id, e.target.value)}
                  className="text-xs rounded-md border bg-[#0A0A0A] border-white/10 hover:border-[#E10600] focus:border-[#E10600] outline-none text-white/90 px-2 py-1.5 min-w-[140px]"
                >
                  <option value="">— Sin asignar —</option>
                  {techs.filter((t) => t.active).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Td>
              <Td>
                <select
                  data-testid={`appt-status-${a.id}`}
                  value={a.status}
                  onChange={(e) => onStatus(a.id, e.target.value)}
                  className={`text-xs uppercase tracking-wider rounded-full px-3 py-1 border bg-transparent outline-none ${STATUS_COLOR[a.status] || ""}`}
                >
                  {APPT_STATUS.map((s) => <option key={s} value={s} className="bg-[#111] text-white">{s}</option>)}
                </select>
              </Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button data-testid={`appt-invoice-${a.id}`} onClick={() => onInvoice(a)} title="Factura" className="text-white/40 hover:text-[#E10600] transition p-1">
                    <Receipt size={16} weight="duotone" />
                  </button>
                  <button data-testid={`appt-delete-${a.id}`} onClick={() => onDelete(a.id)} title="Eliminar" className="text-white/40 hover:text-[#E10600] transition p-1">
                    <Trash size={16} />
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessagesTable({ contacts, onStatus, onDelete, t }) {
  return (
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
                  onChange={(e) => onStatus(c.id, e.target.value)}
                  className={`text-xs uppercase tracking-wider rounded-full px-3 py-1 border bg-transparent outline-none ${STATUS_COLOR[c.status] || ""}`}
                >
                  {CONTACT_STATUS.map((s) => <option key={s} value={s} className="bg-[#111] text-white">{s}</option>)}
                </select>
              </Td>
              <Td>
                <button data-testid={`contact-delete-${c.id}`} onClick={() => onDelete(c.id)} className="text-white/40 hover:text-[#E10600] transition">
                  <Trash size={16} />
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TechniciansPanel({ techs, onChanged }) {
  const [editing, setEditing] = useState(null); // null | "new" | tech.id
  const [form, setForm] = useState({ name: "", phone: "", specialty: "", active: true });

  const startCreate = () => { setForm({ name: "", phone: "", specialty: "", active: true }); setEditing("new"); };
  const startEdit = (t) => { setForm({ name: t.name, phone: t.phone, specialty: t.specialty, active: t.active }); setEditing(t.id); };
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nombre requerido"); return; }
    try {
      if (editing === "new") {
        await api.post("/admin/technicians", form);
        toast.success("Técnico agregado");
      } else {
        await api.patch(`/admin/technicians/${editing}`, form);
        toast.success("Técnico actualizado");
      }
      setEditing(null);
      onChanged();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Error"); }
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar este técnico? Se desasignará de todas las citas.")) return;
    try {
      await api.delete(`/admin/technicians/${id}`);
      toast.success("Eliminado");
      onChanged();
    } catch (e) { toast.error("Error"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl tracking-wide">Equipo de Técnicos</h2>
          <p className="text-xs text-white/40 mt-1">Gestiona el equipo del taller y asígnalos a cada cita.</p>
        </div>
        {editing !== "new" && (
          <button data-testid="add-tech-button" onClick={startCreate} className="inline-flex items-center gap-2 btn-red text-white text-sm px-4 py-2 rounded-full">
            <Plus size={16} weight="bold" /> Nuevo técnico
          </button>
        )}
      </div>

      {editing === "new" && (
        <TechForm form={form} setForm={setForm} onSave={save} onCancel={cancel} title="Nuevo Técnico" />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {techs.length === 0 && editing !== "new" ? (
          <div className="col-span-full text-center py-12 text-white/40 border border-dashed border-white/10 rounded-2xl">
            Aún no hay técnicos. Agrega el primero arriba.
          </div>
        ) : techs.map((t) => editing === t.id ? (
          <TechForm key={t.id} form={form} setForm={setForm} onSave={save} onCancel={cancel} title="Editar técnico" />
        ) : (
          <div key={t.id} data-testid={`tech-card-${t.id}`} className="relative rounded-2xl border border-white/10 bg-[#0F0F10] p-5 hover:border-[#E10600]/40 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-full grid place-items-center font-display text-lg ${t.active ? "bg-[#E10600]/15 text-[#E10600]" : "bg-white/5 text-white/40"}`}>
                  {t.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "T"}
                </div>
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-white/40">{t.specialty || "—"}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button data-testid={`tech-edit-${t.id}`} onClick={() => startEdit(t)} className="p-1.5 text-white/40 hover:text-white transition">
                  <PencilSimple size={16} />
                </button>
                <button data-testid={`tech-delete-${t.id}`} onClick={() => remove(t.id)} className="p-1.5 text-white/40 hover:text-[#E10600] transition">
                  <Trash size={16} />
                </button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-white/50">{t.phone || "Sin teléfono"}</span>
              <span className={`uppercase tracking-[0.18em] ${t.active ? "text-emerald-400" : "text-white/40"}`}>
                {t.active ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TechForm({ form, setForm, onSave, onCancel, title }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  return (
    <div className="rounded-2xl border border-[#E10600]/40 bg-[#161617] p-5 space-y-4" data-testid="tech-form">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg tracking-wider">{title}</h3>
        <button onClick={onCancel} className="text-white/40 hover:text-white"><X size={18} /></button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1.5">Nombre *</label>
          <input data-testid="tech-name-input" value={form.name} onChange={set("name")} className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1.5">Teléfono</label>
          <input data-testid="tech-phone-input" value={form.phone} onChange={set("phone")} placeholder="809-555-0000" className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1.5">Especialidad</label>
          <input data-testid="tech-specialty-input" value={form.specialty} onChange={set("specialty")} placeholder="Ej. Motor, Eléctrico, Transmisión…" className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={set("active")} className="accent-[#E10600] w-4 h-4" />
          Activo (disponible para asignar)
        </label>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button data-testid="tech-save-button" onClick={onSave} className="inline-flex items-center gap-2 btn-red text-white text-sm px-4 py-2 rounded-full">
          <Check size={16} weight="bold" /> Guardar
        </button>
        <button onClick={onCancel} className="text-sm text-white/60 hover:text-white px-3 py-2">Cancelar</button>
      </div>
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
      className={`px-4 py-3 text-sm uppercase tracking-[0.18em] border-b-2 transition whitespace-nowrap ${
        active ? "border-[#E10600] text-white" : "border-transparent text-white/50 hover:text-white"
      }`}
    >
      {children} <span className="ml-2 text-xs text-white/40">{count}</span>
    </button>
  );
}

const Th = ({ children }) => <th className="text-left px-5 py-3 font-medium">{children}</th>;
const Td = ({ children, className = "" }) => <td className={`px-5 py-4 ${className}`}>{children}</td>;
