import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus, PencilSimple, Trash, X, Check, Package, Warning, ArrowUp, ArrowDown,
  ClockCounterClockwise, MagnifyingGlass, MagicWand,
} from "@phosphor-icons/react";
import { api, formatApiErrorDetail } from "@/lib/api";
import InvoiceScanner from "@/components/InvoiceScanner";

const money = (v) => `RD$ ${Number(v || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORIES = ["Aceites", "Filtros", "Frenos", "Eléctrico", "Neumáticos", "Accesorios", "Refrigerantes", "Lubricantes", "Otros"];
const UNITS = ["unidad", "litro", "galón", "pieza", "juego", "metro", "kg"];

const blankProduct = () => ({
  name: "", sku: "", category: "Aceites", unit: "unidad", cost: 0, price: 0,
  current_stock: 0, min_stock: 0, notes: "",
});

export default function InventoryPanel() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | id
  const [form, setForm] = useState(blankProduct());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | low
  const [movementFor, setMovementFor] = useState(null); // { product, type: 'restock' | 'use' }
  const [historyFor, setHistoryFor] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/products");
      setProducts(data);
    } catch (e) {
      toast.error("Error cargando inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const lowStock = products.filter((p) => p.low_stock);
  const filtered = products
    .filter((p) => (filter === "low" ? p.low_stock : true))
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  const totalValue = products.reduce((s, p) => s + p.current_stock * (p.cost || 0), 0);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nombre requerido"); return; }
    const payload = {
      ...form,
      cost: Number(form.cost || 0),
      price: Number(form.price || 0),
      current_stock: Number(form.current_stock || 0),
      min_stock: Number(form.min_stock || 0),
    };
    try {
      if (editing === "new") {
        await api.post("/admin/products", payload);
        toast.success("Producto agregado");
      } else {
        await api.patch(`/admin/products/${editing}`, payload);
        toast.success("Producto actualizado");
      }
      setEditing(null);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Error"); }
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar este producto del inventario?")) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success("Eliminado");
      load();
    } catch (e) { toast.error("Error"); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-wide">Inventario del Taller</h2>
          <p className="text-xs text-white/40 mt-1">Productos, repuestos y consumibles del taller.</p>
        </div>
        {editing !== "new" && (
          <button onClick={() => { setForm(blankProduct()); setEditing("new"); }} data-testid="add-product-button" className="inline-flex items-center gap-2 btn-red ripple text-white text-sm px-4 py-2 rounded-full">
            <Plus size={16} weight="bold" /> Nuevo producto
          </button>
        )}
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="rounded-2xl border border-[#E10600]/40 bg-[#E10600]/5 p-4 flex items-start gap-3" data-testid="low-stock-alert">
          <Warning size={22} weight="fill" className="text-[#E10600] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-[#FF6B65]">{lowStock.length} producto{lowStock.length > 1 ? "s" : ""} con stock bajo</div>
            <div className="text-xs text-white/60 mt-1">
              {lowStock.slice(0, 5).map((p) => p.name).join(", ")}{lowStock.length > 5 ? "…" : ""}
            </div>
          </div>
          <button onClick={() => setFilter("low")} className="text-xs uppercase tracking-[0.18em] text-[#E10600] hover:text-white border border-[#E10600]/40 hover:bg-[#E10600] px-3 py-1.5 rounded-full transition">
            Ver
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Productos" value={products.length} icon={Package} />
        <MiniStat label="Con Stock Bajo" value={lowStock.length} icon={Warning} accent />
        <MiniStat label="Valor Inventario" value={money(totalValue)} small />
        <MiniStat label="Categorías" value={new Set(products.map((p) => p.category)).size} />
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            data-testid="product-search"
            placeholder="Buscar por nombre o SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-[#0F0F10] border border-white/10 rounded-lg p-0.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterChip>
          <FilterChip active={filter === "low"} onClick={() => setFilter("low")} accent>Stock bajo</FilterChip>
        </div>
      </div>

      {/* Edit form */}
      {(editing === "new" || (editing && editing !== "new")) && (
        <ProductForm
          form={form}
          setForm={setForm}
          onSave={save}
          onCancel={() => setEditing(null)}
          title={editing === "new" ? "Nuevo producto" : "Editar producto"}
        />
      )}

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-white/40 text-sm uppercase tracking-[0.3em]">Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-[#0F0F10] text-white/50 text-[10px] uppercase tracking-[0.2em]">
              <tr>
                <Th>Producto</Th>
                <Th>Categoría</Th>
                <Th>Stock</Th>
                <Th>Mínimo</Th>
                <Th>Precio Venta</Th>
                <Th>Costo</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-white/40 py-12">Sin productos. Agrega el primero.</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id} data-testid={`product-row-${p.id}`} className={`border-t border-white/5 hover:bg-white/[0.02] ${p.low_stock ? "bg-[#E10600]/[0.04]" : ""}`}>
                  <Td>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-white/40">{p.sku || "—"}</div>
                  </Td>
                  <Td><span className="text-xs uppercase tracking-wider text-white/70">{p.category}</span></Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${p.low_stock ? "text-[#FF6B65]" : "text-white"}`}>{p.current_stock}</span>
                      <span className="text-xs text-white/40">{p.unit}</span>
                      {p.low_stock && <Warning size={14} weight="fill" className="text-[#E10600]" />}
                    </div>
                  </Td>
                  <Td className="text-xs text-white/50">{p.min_stock}</Td>
                  <Td className="text-white/90">{money(p.price)}</Td>
                  <Td className="text-xs text-white/60">{money(p.cost)}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button title="Registrar entrada (compra)" onClick={() => setMovementFor({ product: p, type: "restock" })} data-testid={`product-restock-${p.id}`} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-md transition">
                        <ArrowUp size={16} weight="bold" />
                      </button>
                      <button title="Registrar salida (uso)" onClick={() => setMovementFor({ product: p, type: "use" })} data-testid={`product-use-${p.id}`} className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-md transition">
                        <ArrowDown size={16} weight="bold" />
                      </button>
                      <button title="Historial" onClick={() => setHistoryFor(p)} className="p-1.5 text-white/50 hover:bg-white/5 rounded-md transition">
                        <ClockCounterClockwise size={16} />
                      </button>
                      <button title="Editar" onClick={() => { setForm({ name: p.name, sku: p.sku, category: p.category, unit: p.unit, cost: p.cost, price: p.price, current_stock: p.current_stock, min_stock: p.min_stock, notes: p.notes }); setEditing(p.id); }} data-testid={`product-edit-${p.id}`} className="p-1.5 text-white/40 hover:text-white transition">
                        <PencilSimple size={16} />
                      </button>
                      <button title="Eliminar" onClick={() => remove(p.id)} data-testid={`product-delete-${p.id}`} className="p-1.5 text-white/40 hover:text-[#E10600] transition">
                        <Trash size={16} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {movementFor && (
        <MovementModal
          product={movementFor.product}
          type={movementFor.type}
          onClose={() => setMovementFor(null)}
          onDone={() => { setMovementFor(null); load(); }}
        />
      )}
      {historyFor && (
        <HistoryModal product={historyFor} onClose={() => setHistoryFor(null)} />
      )}
      {scannerOpen && (
        <InvoiceScanner onClose={() => setScannerOpen(false)} onDone={() => { setScannerOpen(false); load(); }} />
      )}
    </div>
  );
}

function ProductForm({ form, setForm, onSave, onCancel, title }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="rounded-2xl border border-[#E10600]/40 bg-[#161617] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg tracking-wider">{title}</h3>
        <button onClick={onCancel} className="text-white/40 hover:text-white"><X size={18} /></button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Nombre *" value={form.name} onChange={set("name")} testid="product-name" />
        <Field label="SKU / Código" value={form.sku} onChange={set("sku")} placeholder="OPC" />
        <SelectField label="Categoría" value={form.category} onChange={set("category")} options={CATEGORIES} />
        <SelectField label="Unidad" value={form.unit} onChange={set("unit")} options={UNITS} />
        <Field label="Costo (compra)" type="number" step="0.01" min="0" value={form.cost} onChange={set("cost")} placeholder="0.00" />
        <Field label="Precio venta" type="number" step="0.01" min="0" value={form.price} onChange={set("price")} placeholder="0.00" />
        <Field label="Stock actual" type="number" step="0.01" min="0" value={form.current_stock} onChange={set("current_stock")} />
        <Field label="Stock mínimo (alerta)" type="number" step="0.01" min="0" value={form.min_stock} onChange={set("min_stock")} testid="product-min" />
        <Field label="Notas" value={form.notes} onChange={set("notes")} placeholder="OPC" />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button onClick={onSave} data-testid="product-save" className="inline-flex items-center gap-2 btn-red text-white text-sm px-4 py-2 rounded-full">
          <Check size={16} weight="bold" /> Guardar
        </button>
        <button onClick={onCancel} className="text-sm text-white/60 hover:text-white px-3 py-2">Cancelar</button>
      </div>
    </div>
  );
}

function MovementModal({ product, type, onClose, onDone }) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [loading, setLoading] = useState(false);
  const isRestock = type === "restock";

  const submit = async () => {
    const q = Number(qty);
    if (!q || q <= 0) { toast.error("Cantidad inválida"); return; }
    setLoading(true);
    try {
      const payload = { quantity: q, note };
      if (isRestock && unitCost) payload.unit_cost = Number(unitCost);
      await api.post(`/admin/products/${product.id}/${isRestock ? "restock" : "use"}`, payload);
      toast.success(isRestock ? "Entrada registrada" : "Salida registrada");
      onDone();
    } catch (e) { toast.error("Error"); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F0F10] p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl tracking-wider flex items-center gap-2">
              {isRestock ? <ArrowUp size={20} className="text-emerald-400" /> : <ArrowDown size={20} className="text-amber-400" />}
              {isRestock ? "Registrar Compra / Entrada" : "Registrar Uso / Salida"}
            </h3>
            <div className="text-sm text-white/60 mt-1">{product.name}</div>
            <div className="text-xs text-white/40">Stock actual: {product.current_stock} {product.unit}</div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1.5">Cantidad ({product.unit}) *</label>
          <input
            data-testid="movement-qty"
            type="number"
            step="0.01"
            min="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm"
            autoFocus
          />
        </div>
        {isRestock && (
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1.5">Costo unitario (opcional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder={`Actual: ${product.cost}`}
              className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        )}
        <div>
          <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1.5">Nota</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isRestock ? "Ej. Compra a Importadora XYZ" : "Ej. Usado en cita de Bernard"}
            className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button onClick={submit} disabled={loading} data-testid="movement-submit" className="flex-1 btn-red ripple text-white text-sm px-4 py-2.5 rounded-full disabled:opacity-60">
            {loading ? "…" : "Confirmar"}
          </button>
          <button onClick={onClose} className="text-sm text-white/60 hover:text-white px-3 py-2.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ product, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/admin/products/${product.id}/movements`);
        setItems(data);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [product.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-white/10 bg-[#0F0F10] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="font-display text-xl tracking-wider">Historial de movimientos</h3>
            <div className="text-sm text-white/60">{product.name}</div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-12 text-center text-white/40 text-sm uppercase tracking-[0.3em]">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-sm">Sin movimientos aún</div>
          ) : (
            <ul className="space-y-2">
              {items.map((m) => {
                const isIn = m.type === "restock";
                return (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg border border-white/5 p-3">
                    <div className={`w-9 h-9 rounded-md grid place-items-center ${isIn ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                      {isIn ? <ArrowUp size={16} weight="bold" /> : <ArrowDown size={16} weight="bold" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm flex items-center gap-2">
                        <span className="font-medium">{isIn ? "+" : "−"}{m.quantity} {product.unit}</span>
                        <span className="text-xs text-white/40 uppercase tracking-wider">{isIn ? "Entrada" : "Salida"}</span>
                      </div>
                      {m.note && <div className="text-xs text-white/50 mt-0.5">{m.note}</div>}
                    </div>
                    <div className="text-xs text-white/40">{new Date(m.created_at).toLocaleDateString("es-DO")} {new Date(m.created_at).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, testid, ...props }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1.5">{label}</label>
      <input
        data-testid={testid}
        {...props}
        className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-white/30"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.25em] text-white/40 block mb-1.5">{label}</label>
      <select value={value} onChange={onChange} className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, accent, small }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "bg-gradient-to-br from-[#E10600]/15 to-transparent border-[#E10600]/30" : "border-white/10 bg-[#0F0F10]"}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{label}</div>
        {Icon ? <Icon size={16} className={accent ? "text-[#E10600]" : "text-white/30"} /> : null}
      </div>
      <div className={`mt-2 font-display tracking-tight ${small ? "text-xl" : "text-3xl"}`}>{value}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children, accent }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs uppercase tracking-[0.18em] transition ${
        active ? (accent ? "bg-[#E10600] text-white" : "bg-white/10 text-white") : "text-white/50 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

const Th = ({ children }) => <th className="text-left px-5 py-3 font-medium">{children}</th>;
const Td = ({ children, className = "" }) => <td className={`px-5 py-4 ${className}`}>{children}</td>;
