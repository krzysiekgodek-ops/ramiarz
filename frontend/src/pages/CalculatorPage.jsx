import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  Calculator, RefreshCw, AlertCircle, ChevronDown, Layers, Square,
  Building2, Save, Printer, MessageSquare, X, Package, Check, TrendingUp,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCalculator } from "../hooks/useCalculator";

// ─── Pole numeryczne ─────────────────────────────────────────────────────────
function NumericField({ label, value, onChange, min = 0, step = 1, unit = "cm" }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          step={step}
          className="input-field pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
          style={{ color: "var(--text-dim)" }}>
          {unit}
        </span>
      </div>
    </div>
  );
}

// ─── Pole select ─────────────────────────────────────────────────────────────
function SelectField({ label, value, onChange, options = [], placeholder = "— wybierz —" }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="input-field appearance-none pr-9 cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-dim)" }} />
      </div>
    </div>
  );
}

// ─── Toggle Listwa/Rama ───────────────────────────────────────────────────────
function PriceToggle({ value, onChange }) {
  return (
    <div className="flex rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden text-xs shrink-0 h-9 self-end mb-0.5">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-2.5 transition-colors ${!value ? "bg-accent-500/20 text-accent-400 font-medium" : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"}`}
      >
        Listwa
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-2.5 transition-colors ${value ? "bg-accent-500/20 text-accent-400 font-medium" : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"}`}
      >
        Rama
      </button>
    </div>
  );
}

// ─── Wiersz wyniku ───────────────────────────────────────────────────────────
function ResultRow({ label, purchase, client, highlight = false }) {
  const cls = highlight ? "font-semibold border-t border-stone-200 dark:border-stone-700 mt-1 pt-2" : "";
  return (
    <div className={`flex justify-between items-center py-1.5 ${cls}`}>
      <span className="text-sm" style={{ color: highlight ? "var(--text)" : "var(--text-dim)" }}>{label}</span>
      <div className="flex gap-4 text-right">
        {purchase !== undefined && (
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)", minWidth: 72 }}>
            {purchase.toFixed(2)} zł
          </span>
        )}
        <span className={`font-mono ${highlight ? "text-base font-bold text-accent-400" : "text-sm"}`}
          style={!highlight ? { color: "var(--text)" } : {}}>
          {client.toFixed(2)} zł
        </span>
      </div>
    </div>
  );
}

// ─── Podgląd osiąganej marży ─────────────────────────────────────────────────
// Marża handlowa = (cena_klienta − koszt_zakupu) / cena_klienta.
// Wartość niezależna od VAT (skraca się), więc liczymy wprost na kwotach brutto.
// Dla pojedynczej listwy z marżą 50% wychodzi 50%, a zysk = koszt surowca.
function MarginSummary({ result }) {
  const cost   = result.total_cost_brutto ?? 0; // koszt zakupu (brutto)
  const price  = result.total ?? 0;             // cena klienta po rabacie (brutto)
  const profit = price - cost;
  const marginPct = price > 0 ? (profit / price) * 100 : 0; // marża handlowa
  const markupPct = cost  > 0 ? (profit / cost)  * 100 : null; // narzut

  const tone =
    marginPct >= 50 ? "emerald" :
    marginPct >= 30 ? "amber" : "red";
  const toneText = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber:   "text-amber-600 dark:text-amber-400",
    red:     "text-red-600 dark:text-red-400",
  }[tone];
  const toneBg = {
    emerald: "bg-emerald-500/10 border-emerald-500/20",
    amber:   "bg-amber-500/10 border-amber-500/20",
    red:     "bg-red-500/10 border-red-500/20",
  }[tone];

  return (
    <div
      className={`mt-3 rounded-xl border px-3.5 py-3 ${toneBg}`}
      title="Marża handlowa = (cena klienta − koszt zakupu) / cena klienta"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} className={toneText} />
          <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Marża handlowa
          </span>
        </div>
        <span className={`text-lg font-bold font-mono ${toneText}`}>
          {marginPct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span>
          Zysk:{" "}
          <span className="font-mono" style={{ color: "var(--text-dim)" }}>{profit.toFixed(2)} zł</span>
        </span>
        {markupPct !== null && (
          <span>
            Narzut:{" "}
            <span className="font-mono" style={{ color: "var(--text-dim)" }}>{markupPct.toFixed(0)}%</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Budowanie szablonu uwag ─────────────────────────────────────────────────
function buildNotesTemplate(params, mouldingsRaw, matsRaw) {
  const lines = [];
  lines.push(`Wymiar pracy: ${params.width_cm}×${params.height_cm} cm`);
  const main = mouldingsRaw.find((m) => m.id === params.moulding_id);
  if (main) lines.push(`Listwa: ${main.code}, kolor: `);
  const liner = mouldingsRaw.find((m) => m.id === params.liner_id);
  if (liner) lines.push(`Wkładka: ${liner.code}, kolor: `);
  const front = matsRaw.find((m) => m.id === params.front_id);
  if (front) lines.push(`Front: ${front.name}`);
  const backing = matsRaw.find((m) => m.id === params.backing_id);
  if (backing) lines.push(`Plecy: ${backing.name}`);
  const foam = matsRaw.find((m) => m.id === params.foam_id);
  if (foam) lines.push(`Pianka: ${foam.name}`);
  const pp = matsRaw.find((m) => m.id === params.pp_id);
  if (pp) lines.push(`Passepartout kolor: , szerokość:  cm`);
  return lines.join("\n");
}

// ─── Modal zapisu zlecenia ────────────────────────────────────────────────────
function SaveModal({ total, onClose, onSaved, initialDetails = "", shop }) {
  const [form, setForm] = useState({
    customer: "", phone: "", details: initialDetails, deposit: "", pickupDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedOrder, setSavedOrder] = useState(null);
  const [showOrderPrint, setShowOrderPrint] = useState(false);

  const depositVal = parseFloat(form.deposit) || 0;
  const remaining = Math.max(0, total - depositVal);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const today = new Date();
      const nr = `ZL/${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${Date.now().toString().slice(-5)}`;
      const res = await api.post("/orders", {
        order_nr:     nr,
        customer:     form.customer    || null,
        phone:        form.phone       || null,
        details:      form.details     || null,
        pickup_date:  form.pickupDate  || null,
        total_brutto: total,
        deposit:      depositVal,
      });
      const order = res.data ?? {
        order_nr: nr,
        customer: form.customer || null,
        phone: form.phone || null,
        details: form.details || null,
        pickup_date: form.pickupDate || null,
        total_brutto: total,
        deposit: depositVal,
        date: new Date().toISOString(),
      };
      setSavedOrder(order);
      onSaved();
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zapisu zlecenia.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    setShowOrderPrint(true);
    const cleanup = () => { setShowOrderPrint(false); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 120);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card p-6 w-full max-w-sm overflow-y-auto max-h-[90vh]">

        {savedOrder ? (
          /* ─── Stan po zapisie ─────────────────────────────────────────── */
          <>
            <div className="flex flex-col items-center gap-3 py-5 mb-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check size={28} className="text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold" style={{ color: "var(--text)" }}>Zlecenie zapisane</p>
                <p className="font-mono text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>{savedOrder.order_nr}</p>
                {savedOrder.customer && (
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{savedOrder.customer}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm"
              >
                <Printer size={14} />
                Drukuj
              </button>
              <button
                onClick={onClose}
                className="btn-accent flex-1 flex items-center justify-center gap-2 text-sm"
              >
                <X size={14} />
                Zamknij
              </button>
            </div>
          </>
        ) : (
          /* ─── Formularz ───────────────────────────────────────────────── */
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>Zapisz zlecenie</h3>
              <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="label">Imię i nazwisko klienta</label>
                <input
                  type="text"
                  value={form.customer}
                  onChange={(e) => setForm((p) => ({ ...p, customer: e.target.value }))}
                  className="input-field"
                  placeholder="Jan Kowalski"
                />
              </div>
              <div>
                <label className="label">Nr telefonu</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="input-field"
                  placeholder="+48 000 000 000"
                />
              </div>
              <div>
                <label className="label">Termin odbioru</label>
                <input
                  type="date"
                  value={form.pickupDate}
                  onChange={(e) => setForm((p) => ({ ...p, pickupDate: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Uwagi</label>
                <textarea
                  value={form.details}
                  onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))}
                  className="input-field resize-none"
                  rows={4}
                  placeholder="Listwa, kolor, passepartout…"
                />
              </div>
              <div>
                <label className="label">Zaliczka</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.deposit}
                    onChange={(e) => setForm((p) => ({ ...p, deposit: e.target.value }))}
                    className="input-field pr-8"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                    style={{ color: "var(--text-muted)" }}>zł</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-sm mb-4 p-3 rounded-xl" style={{ background: "var(--bg)" }}>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-dim)" }}>Łącznie brutto</span>
                <span className="font-mono font-semibold" style={{ color: "var(--text)" }}>{total.toFixed(2)} zł</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-dim)" }}>Zaliczka</span>
                <span className="font-mono" style={{ color: "var(--text)" }}>{depositVal.toFixed(2)} zł</span>
              </div>
              <div className="flex justify-between pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                <span className="font-medium" style={{ color: "var(--text)" }}>Pozostało</span>
                <span className={`font-mono font-semibold ${remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {remaining > 0 ? `${remaining.toFixed(2)} zł` : "Rozliczone"}
                </span>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mb-3">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost flex-1 text-sm">Anuluj</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-accent flex-1 flex items-center justify-center gap-2 text-sm">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                {saving ? "Zapisuję…" : "Zapisz"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Wydruk zlecenia po zapisie */}
      {showOrderPrint && savedOrder && createPortal(
        <div className="print-portal" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "#000" }}>
          <div style={{ borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: "bold" }}>{shop?.company_name ?? "Zakład oprawiarski"}</div>
            {shop?.address && <div style={{ fontSize: 12 }}>{shop.address}</div>}
            {shop?.phone && <div style={{ fontSize: 12 }}>Tel: {shop.phone}</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Nr zlecenia</div>
              <strong style={{ fontSize: 16 }}>{savedOrder.order_nr}</strong>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Data przyjęcia</div>
              <strong>{new Date().toLocaleDateString("pl-PL")}</strong>
            </div>
          </div>
          {(savedOrder.customer || savedOrder.phone) && (
            <div style={{ border: "1px solid #ccc", borderRadius: 4, padding: "6px 10px", marginBottom: 10 }}>
              {savedOrder.customer && <div><strong>Klient:</strong> {savedOrder.customer}</div>}
              {savedOrder.phone && <div><strong>Tel:</strong> {savedOrder.phone}</div>}
            </div>
          )}
          {savedOrder.details && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Uwagi / Opis zlecenia</div>
              <div style={{ whiteSpace: "pre-wrap", border: "1px solid #ccc", borderRadius: 4, padding: "6px 10px", minHeight: 60 }}>
                {savedOrder.details}
              </div>
            </div>
          )}
          <div style={{ textAlign: "right", marginTop: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Kwota do zapłaty</div>
            <strong style={{ fontSize: 22 }}>{(savedOrder.total_brutto ?? 0).toFixed(2)} zł</strong>
          </div>
          <div style={{ borderTop: "1px dashed #999", margin: "24px 0" }} />
          <div style={{ fontSize: 12 }}>
            <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>Potwierdzenie przyjęcia zlecenia</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>Nr: <strong>{savedOrder.order_nr}</strong></div>
              <div>Data: {new Date().toLocaleDateString("pl-PL")}</div>
            </div>
            {savedOrder.customer && <div>Klient: {savedOrder.customer}</div>}
            <div style={{ fontSize: 12, fontWeight: "bold", marginTop: 3 }}>
              {shop?.company_name}{shop?.address ? ` · ${shop.address}` : ""}
              {shop?.phone ? ` · Tel: ${shop.phone}` : ""}
              {shop?.email ? ` · ${shop.email}` : ""}
              {shop?.website ? ` · ${shop.website}` : ""}
            </div>
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
              <div>Zaliczka: <strong>{(savedOrder.deposit ?? 0).toFixed(2)} zł</strong></div>
              <div>Do zapłaty: <strong>{Math.max(0, (savedOrder.total_brutto ?? 0) - (savedOrder.deposit ?? 0)).toFixed(2)} zł</strong></div>
            </div>
            {savedOrder.pickup_date && (
              <div style={{ marginTop: 4 }}>Termin odbioru: <strong>{new Date(savedOrder.pickup_date).toLocaleDateString("pl-PL")}</strong></div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Główna strona ───────────────────────────────────────────────────────────
export default function CalculatorPage() {
  const { dbUser } = useAuth();
  const shop = dbUser?.settings ?? null;
  const location = useLocation();
  const { params, updateParam, result, loading, error, calculate, reset } = useCalculator();

  const [mouldingsRaw,            setMouldingsRaw]            = useState([]);
  const [matsRaw,                 setMatsRaw]                 = useState([]);
  const [activeSuppliers,         setActiveSuppliers]         = useState([]);
  const [selectedSupplierIdMain,  setSelectedSupplierIdMain]  = useState(null);
  const [selectedSupplierIdLiner, setSelectedSupplierIdLiner] = useState(null);
  const [frontOptions,       setFrontOptions]       = useState([]);
  const [backingOptions,     setBackingOptions]     = useState([]);
  const [foamOptions,        setFoamOptions]        = useState([]);
  const [ppOptions,          setPpOptions]          = useState([]);
  const [framePriceOptions,  setFramePriceOptions]  = useState([]);
  const [dataLoading,        setDataLoading]        = useState(true);
  const [notes,              setNotes]              = useState("");
  const [showPrint,          setShowPrint]          = useState(false);
  const [saveModalOpen,      setSaveModalOpen]      = useState(false);
  const [savedOk,            setSavedOk]            = useState(false);

  // „Nowa wycena" z dolnego paska (przycisk +) — czyści formularz nawet gdy już jesteśmy w kalkulatorze.
  useEffect(() => {
    if (location.state?.newQuote) {
      reset();
      setNotes("");
      setSavedOk(false);
    }
  }, [location.state?.newQuote, reset]);

  useEffect(() => {
    const load = async () => {
      setDataLoading(true);
      try {
        const [mRes, matRes, configRes] = await Promise.all([
          api.get("/mouldings").catch(() => ({ data: [] })),
          api.get("/materials").catch(() => ({ data: [] })),
          api.get("/auth/supplier-configs").catch(() => ({ data: [] })),
        ]);
        const mData   = Array.isArray(mRes.data)      ? mRes.data      : [];
        const matData = Array.isArray(matRes.data)    ? matRes.data    : [];
        const configs = Array.isArray(configRes.data) ? configRes.data : [];

        setMouldingsRaw(mData);
        setMatsRaw(matData);
        setActiveSuppliers(configs.filter((c) => c.config !== null));

        const toOpts = (cat) => matData
          .filter((m) => m.category === cat && m.price > 0)
          .map((m) => ({ id: m.id, label: `${m.name} — ${m.price.toFixed(2)} zł/m²` }));

        setFrontOptions(toOpts("front"));
        setBackingOptions(toOpts("backing"));
        setFoamOptions(toOpts("foam"));
        setPpOptions(toOpts("passepartout"));
        setFramePriceOptions(
          matData
            .filter((m) => m.category === "frame_price" && m.price > 0)
            .map((m) => ({ id: m.id, label: `${m.price.toFixed(2)} zł`, name: m.name }))
        );
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, []);

  const handleSupplierSelectMain = (supplierId) => {
    const newId = supplierId === selectedSupplierIdMain ? null : supplierId;
    setSelectedSupplierIdMain(newId);
    updateParam("moulding_id", null);
  };

  const handleSupplierSelectLiner = (supplierId) => {
    const newId = supplierId === selectedSupplierIdLiner ? null : supplierId;
    setSelectedSupplierIdLiner(newId);
    updateParam("liner_id", null);
  };

  const toMouldingOptions = (supplierId) =>
    (supplierId ? mouldingsRaw.filter((m) => m.supplier_id === supplierId) : mouldingsRaw)
      .map((m) => ({
        id:    m.id,
        label: `${m.code} — ${m.price_strip?.toFixed(2)} zł/mb (${m.width_mm} mm)`,
      }));

  const mouldingOptionsMain  = toMouldingOptions(selectedSupplierIdMain);
  const mouldingOptionsLiner = toMouldingOptions(selectedSupplierIdLiner);

  const handleSaved = () => {
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 4000);
  };

  return (
    <main className="min-h-screen pt-20 pb-28 md:pb-10 px-4 max-w-5xl mx-auto">
      {/* Nagłówek */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-accent-500/20">
          <Calculator size={22} className="text-accent-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>
            Kalkulator wyceny
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Wszystkie ceny brutto (VAT 23%)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Lewa kolumna */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* 1. Dostawca */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={15} className="text-accent-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                Dostawca listew
              </h2>
            </div>
            {dataLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-9 rounded-lg bg-stone-200 dark:bg-stone-800 animate-pulse" />
                ))}
              </div>
            ) : activeSuppliers.length === 0 ? (
              <div className="rounded-lg bg-stone-100 dark:bg-stone-800/60 border border-dashed border-stone-300 dark:border-stone-700 p-4 text-center text-sm"
                style={{ color: "var(--text-dim)" }}>
                Brak skonfigurowanych dostawców.{" "}
                <Link to="/ustawienia" className="text-accent-400 hover:underline">
                  Skonfiguruj w Ustawieniach
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {[
                  { label: "Listwa główna", selectedId: selectedSupplierIdMain,  onSelect: handleSupplierSelectMain },
                  { label: "Wkładka",       selectedId: selectedSupplierIdLiner, onSelect: handleSupplierSelectLiner },
                ].map(({ label, selectedId, onSelect }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs shrink-0 w-24" style={{ color: "var(--text-muted)" }}>{label}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeSuppliers.map((s) => (
                        <button
                          key={s.supplier_id}
                          onClick={() => onSelect(s.supplier_id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            selectedId === s.supplier_id
                              ? "bg-accent-500/20 border-accent-500/40 text-accent-400"
                              : "border-stone-300 dark:border-stone-700 hover:border-accent-500/30 hover:bg-accent-500/5"
                          }`}
                          style={selectedId !== s.supplier_id ? { color: "var(--text)" } : {}}
                        >
                          <Building2 size={11} />
                          {s.supplier_name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Profil listwy */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers size={15} className="text-accent-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                Profil listwy
              </h2>
            </div>
            {dataLoading ? (
              <div className="flex flex-col gap-3">
                <div className="h-10 rounded-lg bg-stone-200 dark:bg-stone-800 animate-pulse" />
                <div className="h-10 rounded-lg bg-stone-200 dark:bg-stone-800 animate-pulse" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Wkładka */}
                <div>
                  <label className="label">Wkładka (podwójna ramka)</label>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <SelectField
                        value={params.liner_id}
                        onChange={(v) => updateParam("liner_id", v)}
                        options={mouldingOptionsLiner}
                        placeholder="— bez wkładki —"
                      />
                    </div>
                    {params.liner_id && (
                      <PriceToggle
                        value={params.use_frame_price_liner}
                        onChange={(v) => updateParam("use_frame_price_liner", v)}
                      />
                    )}
                  </div>
                </div>

                {/* Profil główny */}
                <div>
                  <label className="label" style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>Profil główny</label>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      {mouldingOptionsMain.length > 0 ? (
                        <SelectField
                          value={params.moulding_id}
                          onChange={(v) => updateParam("moulding_id", v)}
                          options={mouldingOptionsMain}
                          placeholder="— wybierz profil —"
                        />
                      ) : (
                        <div className="rounded-lg bg-stone-100 dark:bg-stone-800/60 border border-dashed border-stone-300 dark:border-stone-700 p-3 text-sm"
                          style={{ color: "var(--text-dim)" }}>
                          {mouldingsRaw.length === 0
                            ? <>Brak profili — wgraj cennik w <Link to="/admin" className="text-accent-400 hover:underline">panelu admina</Link>.</>
                            : "Brak profili dla wybranego dostawcy."}
                        </div>
                      )}
                    </div>
                    {params.moulding_id && (
                      <PriceToggle
                        value={params.use_frame_price_main}
                        onChange={(v) => updateParam("use_frame_price_main", v)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Wymiary */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Square size={15} className="text-accent-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                Wymiary pracy
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NumericField
                label="Szerokość"
                value={params.width_cm}
                onChange={(v) => updateParam("width_cm", v)}
                min={1} step={0.5}
              />
              <NumericField
                label="Wysokość"
                value={params.height_cm}
                onChange={(v) => updateParam("height_cm", v)}
                min={1} step={0.5}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: "var(--text-dim)" }}>
              <span>Powierzchnia: <span style={{ color: "var(--text)" }}>
                {((params.width_cm / 100) * (params.height_cm / 100)).toFixed(4)} m²
              </span></span>
              {result && (
                <>
                  <span>Listwa: <span style={{ color: "var(--text)" }}>{result.main_needed_m} mb</span></span>
                  {result.liner_needed_m > 0 && (
                    <span>Wkładka: <span style={{ color: "var(--text)" }}>{result.liner_needed_m} mb</span></span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 4. Materiały dodatkowe */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package size={15} className="text-accent-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                Materiały dodatkowe
              </h2>
            </div>
            <div className="flex flex-col gap-4">
              {frontOptions.length > 0 && (
                <SelectField
                  label="Front (szkło / plexa)"
                  value={params.front_id}
                  onChange={(v) => updateParam("front_id", v)}
                  options={frontOptions}
                  placeholder="— bez frontu —"
                />
              )}
              {backingOptions.length > 0 && (
                <SelectField
                  label="Plecy / tył"
                  value={params.backing_id}
                  onChange={(v) => updateParam("backing_id", v)}
                  options={backingOptions}
                  placeholder="— bez tyłu —"
                />
              )}
              {foamOptions.length > 0 && (
                <SelectField
                  label="Płyta piankowa"
                  value={params.foam_id}
                  onChange={(v) => updateParam("foam_id", v)}
                  options={foamOptions}
                  placeholder="— bez płyty —"
                />
              )}
              {ppOptions.length > 0 && (
                <SelectField
                  label="Passepartout"
                  value={params.pp_id}
                  onChange={(v) => updateParam("pp_id", v)}
                  options={ppOptions}
                  placeholder="— bez passepartout —"
                />
              )}

              {framePriceOptions.length > 0 && (
                <div>
                  <label className="label">Cena oprawy</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateParam("frame_price_id", null)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        !params.frame_price_id
                          ? "bg-accent-500/20 border-accent-500/40 text-accent-400"
                          : "border-stone-300 dark:border-stone-700"
                      }`}
                      style={params.frame_price_id ? { color: "var(--text-dim)" } : {}}
                    >
                      Brak
                    </button>
                    {framePriceOptions.map((fp) => (
                      <button
                        key={fp.id}
                        type="button"
                        onClick={() => updateParam("frame_price_id", params.frame_price_id === fp.id ? null : fp.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          params.frame_price_id === fp.id
                            ? "bg-accent-500/20 border-accent-500/40 text-accent-400"
                            : "border-stone-300 dark:border-stone-700"
                        }`}
                        style={params.frame_price_id !== fp.id ? { color: "var(--text)" } : {}}
                        title={fp.name}
                      >
                        {fp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <NumericField
                label="Koszt dodatkowy"
                value={params.extra_fee}
                onChange={(v) => updateParam("extra_fee", v)}
                min={0} step={1} unit="zł"
              />

              <div>
                <label className="label">Rabat dla klienta: <span className="text-accent-400 font-semibold">{params.discount_pct}%</span></label>
                <input
                  type="range"
                  min={0} max={50} step={1}
                  value={params.discount_pct}
                  onChange={(e) => updateParam("discount_pct", Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 5. Uwagi do zamówienia */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Uwagi do zamówienia</label>
              <button
                type="button"
                onClick={() => setNotes(buildNotesTemplate(params, mouldingsRaw, matsRaw))}
                className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
                style={{ color: "var(--text-dim)", borderColor: "var(--border)" }}
              >
                Wygeneruj szablon
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="np. listwa złota 4cm, kolor: orzech, passepartout kremowe 6cm…"
              className="input-field resize-none text-sm"
            />
          </div>

          {/* Akcje */}
          <div className="flex gap-3">
            <button
              onClick={calculate}
              disabled={loading}
              className="btn-accent flex-1 flex items-center justify-center gap-2"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Calculator size={16} />}
              {loading ? "Obliczam…" : "Oblicz wycenę"}
            </button>
            <button onClick={reset} className="btn-ghost px-4 flex items-center gap-2" title="Resetuj">
              <RefreshCw size={15} />
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* 5. Prawa kolumna — wynik */}
        <div className="lg:col-span-2">
          <div className="glass-card p-5 sticky top-20">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-dim)" }}>
              Wynik wyceny (brutto)
            </h2>

            {!result && !loading && (
              <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                <Calculator size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Wypełnij parametry<br />i kliknij „Oblicz wycenę"</p>
              </div>
            )}

            {loading && (
              <div className="space-y-3 py-4">
                {[80, 70, 75, 65].map((w, i) => (
                  <div key={i} className="h-5 rounded bg-stone-200 dark:bg-stone-800 animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}

            {result && !loading && (
              <>
                {/* Nagłówek kolumn */}
                <div className="flex justify-end gap-4 text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                  <span style={{ minWidth: 72 }}>Zakup</span>
                  <span>Klient</span>
                </div>

                {/* Wkładka */}
                {result.liner_part > 0 && (
                  <ResultRow label="Wkładka" purchase={result.liner_cost} client={result.liner_part} />
                )}

                {/* Listwa */}
                <ResultRow label="Listwa" purchase={result.main_cost} client={result.moulding_part} />

                {/* Materiały */}
                {result.front_part > 0 && (
                  <ResultRow label="Front (szkło/plexa)" purchase={result.front_cost} client={result.front_part} />
                )}
                {result.backing_part > 0 && (
                  <ResultRow label="Plecy / tył" purchase={result.backing_cost} client={result.backing_part} />
                )}
                {result.foam_part > 0 && (
                  <ResultRow label="Płyta piankowa" purchase={result.foam_cost} client={result.foam_part} />
                )}
                {result.pp_part > 0 && (
                  <ResultRow label="Passepartout" purchase={result.pp_cost} client={result.pp_part} />
                )}

                {/* Flat fees */}
                {result.frame_price_part > 0 && (
                  <ResultRow label="Cena oprawy" client={result.frame_price_part} />
                )}
                {result.extra_fee_brutto > 0 && (
                  <ResultRow label="Koszt dodatkowy" client={result.extra_fee_brutto} />
                )}

                {/* Rabat */}
                {result.discount_amount > 0 && (
                  <>
                    <ResultRow
                      label="Przed rabatem"
                      purchase={result.total_cost_brutto}
                      client={result.total_before_discount}
                      highlight
                    />
                    <div className="flex justify-between items-center py-1.5 text-sm">
                      <span style={{ color: "var(--text-dim)" }}>Rabat ({params.discount_pct}%)</span>
                      <span className="font-mono text-amber-500">−{result.discount_amount.toFixed(2)} zł</span>
                    </div>
                  </>
                )}

                {/* Suma końcowa */}
                <div className={`flex justify-between items-center py-2 border-t border-stone-200 dark:border-stone-700 mt-1 ${result.discount_amount > 0 ? "" : "pt-3"}`}>
                  <span className="font-semibold" style={{ color: "var(--text)" }}>
                    {result.discount_amount > 0 ? "Do zapłaty" : "Razem"}
                  </span>
                  <div className="flex gap-4 text-right">
                    {result.discount_amount === 0 && (
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)", minWidth: 72 }}>
                        {result.total_cost_brutto.toFixed(2)} zł
                      </span>
                    )}
                    <span className="text-xl font-bold font-mono text-accent-400">
                      {result.total.toFixed(2)} zł
                    </span>
                  </div>
                </div>

                {/* Podgląd osiąganej marży */}
                <MarginSummary result={result} />

                {/* Przyciski */}
                <div className="mt-4 flex flex-col gap-2">
                  {savedOk ? (
                    <div className="flex items-center justify-center gap-2 py-2 text-emerald-500 text-sm">
                      <Check size={16} />
                      Zlecenie zapisane
                    </div>
                  ) : (
                    <button
                      onClick={() => setSaveModalOpen(true)}
                      className="btn-accent w-full flex items-center justify-center gap-2 text-sm"
                    >
                      <Save size={15} />
                      Zapisz zlecenie
                    </button>
                  )}
                  <div className="flex gap-2">
                    {notes.trim() ? (
                      <button
                        onClick={() => {
                          setShowPrint(true);
                          const cleanup = () => { setShowPrint(false); window.removeEventListener("afterprint", cleanup); };
                          window.addEventListener("afterprint", cleanup);
                          setTimeout(() => window.print(), 120);
                        }}
                        className="btn-ghost flex-1 flex items-center justify-center gap-2 text-xs"
                      >
                        <Printer size={13} />
                        Drukuj
                      </button>
                    ) : (
                      <button
                        disabled
                        title="Przed drukiem wygeneruj szablon uwag"
                        className="btn-ghost flex-1 flex items-center justify-center gap-2 text-xs opacity-50 cursor-not-allowed"
                      >
                        <Printer size={13} />
                        Wygeneruj szablon
                      </button>
                    )}
                    <button
                      onClick={() => {}}
                      className="btn-ghost flex-1 flex items-center justify-center gap-2 text-xs"
                      title="Wyślij SMS (wkrótce)"
                      disabled
                    >
                      <MessageSquare size={13} />
                      SMS
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {saveModalOpen && (
        <SaveModal
          total={result?.total ?? 0}
          onClose={() => setSaveModalOpen(false)}
          onSaved={handleSaved}
          initialDetails={notes}
          shop={shop}
        />
      )}

      {showPrint && result && createPortal(
        <div className="print-portal" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "#000" }}>
          {/* Nagłówek zakładu */}
          <div style={{ borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: "bold" }}>{shop?.company_name ?? "Zakład oprawiarski"}</div>
            {shop?.address && <div style={{ fontSize: 12 }}>{shop.address}</div>}
            {shop?.phone && <div style={{ fontSize: 12 }}>Tel: {shop.phone}</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: "bold" }}>Wycena</div>
            <div style={{ fontSize: 12 }}>{new Date().toLocaleDateString("pl-PL")}</div>
          </div>
          {/* Uwagi */}
          {notes && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Opis zlecenia</div>
              <div style={{ whiteSpace: "pre-wrap", border: "1px solid #ccc", borderRadius: 4, padding: "8px 10px", minHeight: 80 }}>
                {notes}
              </div>
            </div>
          )}
          {/* Cena */}
          <div style={{ textAlign: "right", marginTop: 20 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Cena dla klienta (brutto)</div>
            <div style={{ fontSize: 26, fontWeight: "bold" }}>{result.total.toFixed(2)} zł</div>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
