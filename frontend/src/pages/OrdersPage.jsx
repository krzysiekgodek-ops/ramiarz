import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Archive, Search, AlertCircle, Package, X, Phone, User, Trash2, Save, CheckCircle, Printer, CreditCard, Calendar } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const STATUS = {
  paid:    { label: "Opłacone",      bg: "bg-block-lime",  text: "text-black"       },
  partial: { label: "Zaliczka",      bg: "bg-block-cream", text: "text-black"       },
  unpaid:  { label: "Nierozliczone", bg: "#f1f1f1",        text: "var(--text-dim)"  },
};

function orderStatus(o) {
  const dep = o.deposit ?? 0;
  if (dep >= (o.total_brutto ?? 0)) return STATUS.paid;
  if (dep > 0)                       return STATUS.partial;
  return STATUS.unpaid;
}

// ─── Modal podglądu ───────────────────────────────────────────────────────────
function OrderModal({ order, onClose, onDelete, onSave, onPrint, onSettle }) {
  const [deposit,    setDeposit]    = useState(String(order.deposit ?? 0));
  const [details,    setDetails]    = useState(order.details ?? "");
  const [pickupDate, setPickupDate] = useState(order.pickup_date ?? "");
  const [saving,     setSaving]     = useState(false);
  const [settling,   setSettling]   = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState(null);

  const depositVal = parseFloat(deposit) || 0;
  const remaining  = (order.total_brutto ?? 0) - depositVal;
  const date       = order.date ? new Date(order.date).toLocaleDateString("pl-PL", {
    day: "2-digit", month: "long", year: "numeric"
  }) : "—";
  const pickupFormatted = pickupDate
    ? new Date(pickupDate).toLocaleDateString("pl-PL", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const status = orderStatus({ ...order, deposit: depositVal });

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch(`/orders/${order.id}`, {
        deposit:     depositVal,
        details:     details     || null,
        pickup_date: pickupDate  || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSave(updated.data);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zapisu.");
    } finally {
      setSaving(false);
    }
  };

  const handleSettle = async () => {
    setSettling(true);
    setError(null);
    try {
      const updated = await api.patch(`/orders/${order.id}`, {
        deposit: order.total_brutto,
      });
      onSave(updated.data);
      onSettle(updated.data);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd rozliczania.");
      setSettling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/orders/${order.id}`);
      onDelete(order.id);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd usuwania.");
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card w-full max-w-md overflow-hidden overflow-y-auto max-h-[90vh]">

        {/* Status bar */}
        <div className={`${status.bg} px-6 py-3 flex items-center justify-between`}>
          <span className="font-mono text-xs font-medium tracking-wider uppercase" style={{ color: status.text }}>
            {status.label}
          </span>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-black/10 transition-colors">
            <X size={15} style={{ color: status.text }} />
          </button>
        </div>

        <div className="p-6">
          {/* Nr zlecenia + data */}
          <p className="label mb-0.5">Nr zlecenia</p>
          <p className="font-mono text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>
            {order.order_nr}
          </p>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>{date}</p>

          {/* Klient */}
          {(order.customer || order.phone) && (
            <div className="flex flex-col gap-1.5 mb-5 p-3 rounded-xl" style={{ background: "var(--bg)" }}>
              {order.customer && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text)" }}>
                  <User size={13} style={{ color: "var(--text-muted)" }} />
                  {order.customer}
                </div>
              )}
              {order.phone && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text)" }}>
                  <Phone size={13} style={{ color: "var(--text-muted)" }} />
                  {order.phone}
                </div>
              )}
            </div>
          )}

          {/* Termin odbioru */}
          <div className="mb-4">
            <label className="label">Termin odbioru</label>
            <div className="relative">
              <input
                type="date"
                value={pickupDate}
                onChange={(e) => { setPickupDate(e.target.value); setSaved(false); }}
                className="input-field text-sm"
              />
            </div>
            {pickupFormatted && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <Calendar size={11} /> {pickupFormatted}
              </p>
            )}
          </div>

          {/* Uwagi */}
          <div className="mb-5">
            <label className="label">Uwagi (kolory, passe-partout…)</label>
            <textarea
              value={details}
              onChange={(e) => { setDetails(e.target.value); setSaved(false); }}
              rows={4}
              placeholder="np. listwa złota 4cm, pp kremowe 6cm, szkło antyrefleks…"
              className="input-field resize-none text-sm"
            />
          </div>

          {/* Kwoty */}
          <div className="flex flex-col gap-2 mb-5">
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: "var(--text-dim)" }}>Łącznie brutto</span>
              <span className="font-mono font-semibold text-lg" style={{ color: "var(--text)" }}>
                {order.total_brutto?.toFixed(2)} zł
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: "var(--text-dim)" }}>Zaliczka</span>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deposit}
                    onChange={(e) => { setDeposit(e.target.value); setSaved(false); }}
                    className="input-field w-28 text-right pr-8 py-1.5 text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                    style={{ color: "var(--text-muted)" }}>zł</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Pozostało</span>
              <span className={`font-mono font-semibold ${remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {remaining > 0 ? `${remaining.toFixed(2)} zł` : "Rozliczone"}
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-4">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          {/* Akcje — rząd 1 */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-2"
              style={{ color: "var(--text-muted)" }}
            >
              {deleting
                ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                : <Trash2 size={13} />}
              Usuń
            </button>

            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`btn-accent flex-1 flex items-center justify-center gap-1.5 text-sm py-2 ${saved ? "opacity-100" : ""}`}
              style={saved ? { background: "#1ea64a" } : {}}
            >
              {saving
                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : saved
                  ? <><CheckCircle size={13} /> Zapisano</>
                  : <><Save size={13} /> Zapisz</>}
            </button>
          </div>

          {/* Akcje — rząd 2 */}
          <div className="flex gap-2">
            <button
              onClick={() => onPrint({ ...order, deposit: depositVal, details, pickup_date: pickupDate || null })}
              className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-sm py-2"
            >
              <Printer size={13} />
              Drukuj
            </button>
            {remaining > 0 && (
              <button
                onClick={handleSettle}
                disabled={settling}
                className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-sm py-2"
                style={{ color: "var(--text)" }}
              >
                {settling
                  ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                  : <CreditCard size={13} />}
                Rozlicz
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Wiersz tabeli ────────────────────────────────────────────────────────────
function OrderRow({ o, onClick }) {
  const date      = o.date ? new Date(o.date).toLocaleDateString("pl-PL") : "—";
  const remaining = (o.total_brutto ?? 0) - (o.deposit ?? 0);
  const status    = orderStatus(o);

  return (
    <tr
      onClick={onClick}
      className="border-b hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
      style={{ borderColor: "var(--border-soft)" }}
    >
      <td className="px-4 py-3 font-mono text-xs text-accent-400">{o.order_nr}</td>
      <td className="px-4 py-3 text-sm" style={{ color: "var(--text)" }}>{o.customer ?? "—"}</td>
      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-dim)" }}>{date}</td>
      <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: "var(--text)" }}>
        {o.total_brutto?.toFixed(2)} zł
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm">
        <span className={remaining > 0 ? "text-amber-600 dark:text-amber-400" : ""}
          style={remaining <= 0 ? { color: "var(--text-muted)" } : {}}>
          {remaining > 0 ? `${remaining.toFixed(2)} zł` : "—"}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${status.bg}`}
          style={{ color: "black" }}>
          {status.label}
        </span>
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b" style={{ borderColor: "var(--border-soft)" }}>
      {[28, 42, 18, 18, 18, 14].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-stone-200 dark:bg-stone-800 animate-pulse" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Wydruk zlecenia / Kasa Przyjmie ────────────────────────────────────────
function PrintSheet({ order, mode, shop }) {
  if (!order) return null;
  const date = order.date ? new Date(order.date).toLocaleDateString("pl-PL") : "—";
  const pickupFormatted = order.pickup_date
    ? new Date(order.pickup_date).toLocaleDateString("pl-PL")
    : "—";
  const deposit   = order.deposit ?? 0;
  const remaining = (order.total_brutto ?? 0) - deposit;

  return (
    <div className="print-sheet">
      {mode === "order" ? (
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "#000" }}>
          {/* Nagłówek zakładu */}
          <div style={{ borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: "bold" }}>{shop?.company_name ?? "Zakład oprawiarski"}</div>
            {shop?.address && <div style={{ fontSize: 12 }}>{shop.address}</div>}
            {shop?.phone && <div style={{ fontSize: 12 }}>Tel: {shop.phone}</div>}
          </div>
          {/* Nr i data */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div><span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Nr zlecenia</span><br/><strong style={{ fontSize: 16 }}>{order.order_nr}</strong></div>
            <div style={{ textAlign: "right" }}><span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Data przyjęcia</span><br/><strong>{date}</strong></div>
          </div>
          {/* Klient */}
          {(order.customer || order.phone) && (
            <div style={{ border: "1px solid #ccc", borderRadius: 4, padding: "6px 10px", marginBottom: 10 }}>
              {order.customer && <div><strong>Klient:</strong> {order.customer}</div>}
              {order.phone && <div><strong>Tel:</strong> {order.phone}</div>}
            </div>
          )}
          {/* Uwagi */}
          {order.details && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Uwagi / Opis zlecenia</div>
              <div style={{ whiteSpace: "pre-wrap", border: "1px solid #ccc", borderRadius: 4, padding: "6px 10px", minHeight: 60 }}>
                {order.details}
              </div>
            </div>
          )}
          {/* Cena końcowa */}
          <div style={{ textAlign: "right", marginTop: 16 }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Kwota do zapłaty</span><br/>
            <strong style={{ fontSize: 22 }}>{(order.total_brutto ?? 0).toFixed(2)} zł</strong>
          </div>

          {/* Linia przerywana */}
          <div style={{ borderTop: "1px dashed #999", margin: "24px 0" }} />

          {/* Potwierdzenie dla klienta (dolna 1/4) */}
          <div style={{ fontSize: 12 }}>
            <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>Potwierdzenie przyjęcia zlecenia</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>Nr: <strong>{order.order_nr}</strong></div>
              <div>Data: {date}</div>
            </div>
            {order.customer && <div>Klient: {order.customer}</div>}
            <div style={{ fontSize: 12, fontWeight: "bold", marginTop: 3 }}>
              {shop?.company_name}{shop?.address ? ` · ${shop.address}` : ""}
              {shop?.phone ? ` · Tel: ${shop.phone}` : ""}
              {shop?.email ? ` · ${shop.email}` : ""}
              {shop?.website ? ` · ${shop.website}` : ""}
            </div>
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
              <div>Zaliczka: <strong>{deposit.toFixed(2)} zł</strong></div>
              <div>Do zapłaty: <strong>{remaining > 0 ? `${remaining.toFixed(2)} zł` : "Rozliczone"}</strong></div>
            </div>
            <div style={{ marginTop: 4 }}>Termin odbioru: <strong>{pickupFormatted}</strong></div>
          </div>
        </div>
      ) : (
        /* Kasa Przyjmie */
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "#000", maxWidth: 360 }}>
          <div style={{ fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 8 }}>KASA PRZYJMIE</div>
          {shop?.address && <div style={{ textAlign: "center", fontSize: 12, marginBottom: 12 }}>{shop.company_name} · {shop.address}</div>}
          <div style={{ marginBottom: 6 }}>Data: <strong>{new Date().toLocaleDateString("pl-PL")}</strong></div>
          {order.customer && <div style={{ marginBottom: 6 }}>Zamawiający: <strong>{order.customer}</strong></div>}
          <div style={{ marginBottom: 6 }}>Potwierdzenie zapłaty za zamówienie nr: <strong>{order.order_nr}</strong></div>
          <div style={{ fontSize: 20, fontWeight: "bold", textAlign: "center", border: "2px solid #000", padding: "8px", borderRadius: 4, marginTop: 12 }}>
            {(order.total_brutto ?? 0).toFixed(2)} zł
          </div>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
            <div style={{ borderTop: "1px solid #000", width: "40%", paddingTop: 4, textAlign: "center", fontSize: 11 }}>Podpis kasjera</div>
            <div style={{ borderTop: "1px solid #000", width: "40%", paddingTop: 4, textAlign: "center", fontSize: 11 }}>Podpis klienta</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Strona ───────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { dbUser } = useAuth();
  const shop = dbUser?.settings ?? null;

  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [printMode,   setPrintMode]   = useState("order");
  const afterprintCleanup = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/orders");
        setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e?.response?.data?.detail ?? "Nie udało się pobrać zleceń.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const triggerPrint = (order, mode = "order") => {
    setPrintTarget(order);
    setPrintMode(mode);
    const handler = () => {
      setPrintTarget(null);
      window.removeEventListener("afterprint", handler);
    };
    afterprintCleanup.current = handler;
    window.addEventListener("afterprint", handler);
    setTimeout(() => window.print(), 120);
  };

  const filtered = orders.filter((o) =>
    o.order_nr?.toLowerCase().includes(query.toLowerCase()) ||
    o.customer?.toLowerCase().includes(query.toLowerCase())
  );

  const totalBrutto  = orders.reduce((s, o) => s + (o.total_brutto ?? 0), 0);
  const totalDeposit = orders.reduce((s, o) => s + (o.deposit ?? 0), 0);

  const handleDelete = (id) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setSelected(null);
  };

  const handleSave = (updated) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setSelected(updated);
  };

  return (
    <main className="min-h-screen pt-20 pb-28 md:pb-10 px-4 max-w-5xl mx-auto">
      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-accent-500/10">
            <Archive size={20} className="text-accent-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              Archiwum zleceń
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
              {!loading && `${orders.length} zleceń`}
            </p>
          </div>
        </div>
      </div>

      {/* Statystyki */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Łącznie brutto",   value: `${totalBrutto.toFixed(2)} zł`,               accent: false },
            { label: "Pobrane zaliczki", value: `${totalDeposit.toFixed(2)} zł`,              accent: false },
            { label: "Do rozliczenia",   value: `${(totalBrutto - totalDeposit).toFixed(2)} zł`, accent: totalBrutto > totalDeposit },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4">
              <p className="label">{s.label}</p>
              <p className={`font-mono text-lg font-medium ${s.accent ? "text-amber-600 dark:text-amber-400" : ""}`}
                style={!s.accent ? { color: "var(--text)" } : {}}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Wyszukiwarka */}
      <div className="glass-card p-4 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Szukaj po numerze zlecenia lub nazwisku klienta…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-field pl-9"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm mb-4"
          style={{ background: "#fee2e2", borderColor: "#fca5a5", color: "#dc2626" }}>
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabela */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              {["Nr zlecenia", "Klient", "Data", "Razem", "Pozostało", "Status"].map((h, i) => (
                <th key={h}
                  className={`px-4 py-3 text-xs font-mono font-medium uppercase tracking-wider ${i >= 3 ? "text-right" : "text-left"} ${i === 5 ? "text-center" : ""}`}
                  style={{ color: "var(--text-muted)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)
              : filtered.length > 0
                ? filtered.map((o) => (
                  <OrderRow key={o.id} o={o} onClick={() => setSelected(o)} />
                ))
                : (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <Package size={28} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                      <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                        {query ? "Brak zleceń pasujących do wyszukiwania." : "Brak zleceń."}
                      </p>
                    </td>
                  </tr>
                )}
          </tbody>
        </table>
      </div>

      {selected && (
        <OrderModal
          order={selected}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onSave={handleSave}
          onPrint={(o) => triggerPrint(o, "order")}
          onSettle={(o) => triggerPrint(o, "kasa")}
        />
      )}

      {printTarget && createPortal(
        <div className="print-portal">
          <PrintSheet order={printTarget} mode={printMode} shop={shop} />
        </div>,
        document.body
      )}
    </main>
  );
}
