import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  X, Camera, UploadSimple, Scan, Trash, Check, ArrowsClockwise, Storefront,
  Sparkle, MagicWand, Plus,
} from "@phosphor-icons/react";
import { api, formatApiErrorDetail } from "@/lib/api";

const money = (v) => `RD$ ${Number(v || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvoiceScanner({ onClose, onDone }) {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const [image, setImage] = useState(null); // base64 string (no header)
  const [previewUrl, setPreviewUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [parsed, setParsed] = useState(null); // server response
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([
          api.get("/admin/suppliers"),
          api.get("/admin/products"),
        ]);
        setSuppliers(s.data);
        setProducts(p.data);
      } catch { /* ignore */ }
    })();
  }, []);

  const onFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo imágenes (JPG, PNG, WEBP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagen muy grande (máx 8MB)");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = String(result).split(",")[1];
      setImage(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const scan = async () => {
    if (!image) { toast.error("Carga una imagen primero"); return; }
    setScanning(true);
    setParsed(null);
    try {
      const { data } = await api.post("/admin/inventory/scan-invoice", { image_base64: image });
      setParsed({
        supplier_id: data.suggested_supplier_id || "",
        supplier_name: data.supplier_name || "",
        supplier_phone: data.supplier_phone || "",
        supplier_rnc: data.supplier_rnc || "",
        invoice_number: data.invoice_number || "",
        date: data.date || new Date().toISOString().slice(0, 10),
        items: (data.items || []).map((it) => ({
          description: it.description,
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.unit_price || 0),
          unit: it.unit || "unidad",
          product_id: it.product_id || "",
        })),
        notes: data.notes || "",
      });
      toast.success("Factura leída por la AI ✨");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Error escaneando");
    } finally {
      setScanning(false);
    }
  };

  const updateItem = (i, k, v) => {
    setParsed((p) => ({
      ...p,
      items: p.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)),
    }));
  };

  const removeItem = (i) => setParsed((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const addItem = () => setParsed((p) => ({ ...p, items: [...p.items, { description: "", quantity: 1, unit_price: 0, unit: "unidad", product_id: "" }] }));

  const subtotal = (parsed?.items || []).reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);

  const confirm = async () => {
    if (!parsed) return;
    if (!parsed.supplier_name.trim()) { toast.error("Nombre del proveedor requerido"); return; }
    const validItems = parsed.items.filter((it) => it.description.trim() && Number(it.quantity) > 0);
    if (validItems.length === 0) { toast.error("Agrega al menos 1 item"); return; }
    setSaving(true);
    try {
      await api.post("/admin/purchase-invoices", {
        supplier_id: parsed.supplier_id || null,
        supplier_name: parsed.supplier_name,
        supplier_phone: parsed.supplier_phone,
        supplier_rnc: parsed.supplier_rnc,
        invoice_number: parsed.invoice_number,
        date: parsed.date,
        items: validItems.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          unit: it.unit,
          product_id: it.product_id || null,
        })),
        notes: parsed.notes,
      });
      toast.success("Factura registrada y stock actualizado");
      onDone?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto" data-testid="scanner-modal">
      <div className="relative w-full max-w-5xl my-8 rounded-2xl border border-white/10 bg-[#0F0F10] text-white max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 grid place-items-center rounded-lg bg-[#E10600]/15 text-[#E10600]">
              <MagicWand size={22} weight="duotone" />
            </div>
            <div>
              <h2 className="font-display text-2xl tracking-wide flex items-center gap-2">
                Escanear Factura <Sparkle size={16} className="text-[#E10600]" weight="fill" />
              </h2>
              <div className="text-xs text-white/50">Lee tu factura con AI y registra los productos en inventario</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white" data-testid="scanner-close"><X size={22} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {!parsed ? (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Upload / Preview */}
              <div className="space-y-4">
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Foto de la factura</div>
                <div className="rounded-2xl border-2 border-dashed border-white/15 hover:border-[#E10600]/50 transition bg-[#0A0A0A] aspect-[3/4] flex items-center justify-center relative overflow-hidden">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Factura" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center px-6">
                      <Scan size={56} className="text-white/20 mx-auto mb-3" weight="duotone" />
                      <div className="text-sm text-white/60">Sube o toma una foto de la factura del proveedor</div>
                      <div className="text-xs text-white/40 mt-1">JPG, PNG o WEBP — máx 8MB</div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => fileRef.current?.click()}
                    data-testid="scanner-upload"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:border-[#E10600]/50 hover:bg-white/5 py-3 text-sm transition"
                  >
                    <UploadSimple size={18} /> Subir archivo
                  </button>
                  <button
                    onClick={() => cameraRef.current?.click()}
                    data-testid="scanner-camera"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:border-[#E10600]/50 hover:bg-white/5 py-3 text-sm transition"
                  >
                    <Camera size={18} /> Cámara
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                <button
                  onClick={scan}
                  disabled={!image || scanning}
                  data-testid="scanner-scan"
                  className="w-full btn-red ripple inline-flex items-center justify-center gap-2 rounded-full text-white font-medium py-4 text-base disabled:opacity-50"
                >
                  {scanning ? <><ArrowsClockwise size={18} className="animate-spin" /> Leyendo con AI…</> : <><MagicWand size={18} weight="bold" /> Leer factura con AI</>}
                </button>
              </div>

              {/* Tips */}
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Consejos para mejores resultados</div>
                {[
                  { t: "Foto bien iluminada", d: "Sin sombras encima del papel. Luz natural ideal." },
                  { t: "Encuadre completo", d: "Que se vea toda la factura (proveedor, items y totales)." },
                  { t: "Texto enfocado", d: "Que se lea claro al hacer zoom — sin movimiento." },
                  { t: "Una factura por vez", d: "Si tienes varias, súbelas una por una." },
                ].map((it, i) => (
                  <div key={i} className="rounded-xl border border-white/10 p-4 bg-[#0A0A0A]">
                    <div className="font-medium text-sm">{it.t}</div>
                    <div className="text-xs text-white/50 mt-1">{it.d}</div>
                  </div>
                ))}
                <div className="rounded-xl border border-[#E10600]/30 bg-[#E10600]/5 p-4">
                  <div className="font-medium text-sm text-[#FF6B65]">✨ Qué hace la AI</div>
                  <ul className="text-xs text-white/70 mt-2 space-y-1 list-disc list-inside leading-relaxed">
                    <li>Detecta nombre del proveedor, # de factura y fecha</li>
                    <li>Lee cada item con descripción, cantidad y precio</li>
                    <li>Empareja con productos existentes en tu inventario</li>
                    <li>Tú revisas y confirmas antes de guardar</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <ReviewForm
              parsed={parsed}
              setParsed={setParsed}
              suppliers={suppliers}
              products={products}
              onItemChange={updateItem}
              onItemRemove={removeItem}
              onItemAdd={addItem}
              subtotal={subtotal}
            />
          )}
        </div>

        {parsed && (
          <div className="border-t border-white/10 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-[#0A0A0A]/40">
            <button
              onClick={() => { setParsed(null); setImage(null); setPreviewUrl(""); }}
              className="inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-full border border-white/15 hover:border-white/40 text-white/70"
            >
              ← Escanear otra
            </button>
            <button
              onClick={confirm}
              disabled={saving}
              data-testid="scanner-confirm"
              className="inline-flex items-center gap-2 btn-red ripple text-white text-sm px-5 py-2.5 rounded-full disabled:opacity-60"
            >
              {saving ? "Guardando…" : <><Check size={16} weight="bold" /> Confirmar y sumar al inventario</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewForm({ parsed, setParsed, suppliers, products, onItemChange, onItemRemove, onItemAdd, subtotal }) {
  const set = (k) => (e) => setParsed((p) => ({ ...p, [k]: e.target.value }));
  const selectSupplier = (id) => {
    if (!id) { setParsed((p) => ({ ...p, supplier_id: "" })); return; }
    const s = suppliers.find((x) => x.id === id);
    if (!s) return;
    setParsed((p) => ({ ...p, supplier_id: id, supplier_name: s.name, supplier_phone: s.phone, supplier_rnc: s.rnc }));
  };
  return (
    <div className="space-y-6">
      {/* Supplier section */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-3 flex items-center gap-2">
          <Storefront size={14} /> Proveedor
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-white/50 block mb-1">Existente</label>
            <select
              value={parsed.supplier_id}
              onChange={(e) => selectSupplier(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">— Crear nuevo proveedor —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <Field label="Nombre" value={parsed.supplier_name} onChange={set("supplier_name")} testid="scanner-supplier-name" />
          <Field label="Teléfono" value={parsed.supplier_phone} onChange={set("supplier_phone")} />
          <Field label="RNC" value={parsed.supplier_rnc} onChange={set("supplier_rnc")} />
          <Field label="# Factura" value={parsed.invoice_number} onChange={set("invoice_number")} />
          <Field label="Fecha" type="date" value={parsed.date} onChange={set("date")} />
        </div>
      </section>

      {/* Items */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Productos detectados</div>
          <button onClick={onItemAdd} className="text-xs text-[#E10600] hover:text-white inline-flex items-center gap-1">
            <Plus size={14} weight="bold" /> Agregar item
          </button>
        </div>
        <div className="rounded-xl border border-white/10 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-[#161617] text-[10px] uppercase tracking-[0.18em] text-white/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Descripción</th>
                <th className="text-left px-3 py-2 font-medium w-44">Producto inventario</th>
                <th className="text-center px-2 py-2 font-medium w-20">Cant.</th>
                <th className="text-center px-2 py-2 font-medium w-24">Unidad</th>
                <th className="text-right px-3 py-2 font-medium w-28">Precio</th>
                <th className="text-right px-3 py-2 font-medium w-28">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {parsed.items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-6 text-white/40">Sin items detectados — agrega uno</td></tr>
              ) : parsed.items.map((it, i) => {
                const tot = Number(it.quantity || 0) * Number(it.unit_price || 0);
                const isNew = !it.product_id;
                return (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <input
                        value={it.description}
                        onChange={(e) => onItemChange(i, "description", e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-md px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={it.product_id}
                        onChange={(e) => onItemChange(i, "product_id", e.target.value)}
                        className={`w-full bg-[#0A0A0A] border outline-none text-white rounded-md px-2 py-1.5 text-xs ${
                          isNew ? "border-emerald-500/40 text-emerald-300" : "border-white/10"
                        }`}
                      >
                        <option value="">+ Crear nuevo</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={it.quantity}
                        onChange={(e) => onItemChange(i, "quantity", e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-md px-2 py-1.5 text-sm text-center"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={it.unit}
                        onChange={(e) => onItemChange(i, "unit", e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-md px-2 py-1.5 text-xs text-center"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={it.unit_price}
                        onChange={(e) => onItemChange(i, "unit_price", e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-md px-2 py-1.5 text-sm text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{money(tot)}</td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => onItemRemove(i)} className="text-white/30 hover:text-[#E10600]"><Trash size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-4">
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.25em] text-white/40">Total a sumar al inventario</div>
            <div className="font-display text-3xl text-[#E10600] mt-1">{money(subtotal)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, testid, ...props }) {
  return (
    <div>
      <label className="text-xs text-white/50 block mb-1">{label}</label>
      <input
        data-testid={testid}
        {...props}
        className="w-full bg-[#0A0A0A] border border-white/10 focus:border-[#E10600] outline-none text-white rounded-lg px-3 py-2.5 text-sm"
      />
    </div>
  );
}
