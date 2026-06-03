import { useEffect, useState } from "react";
import { Settings, Save, AlertCircle, CheckCircle, User, Building, Building2, ShieldCheck, ExternalLink, Package } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

const MATERIAL_CATALOG = {
  front: {
    label: "Front (szkło / plexa)",
    unit: "zł/m²",
    items: ["bez szkła", "szkło float", "szkło antyrefleks", "szkło muzealne", "plexa", "plexa antyreflex"],
  },
  backing: {
    label: "Plecy / tył",
    unit: "zł/m²",
    items: ["bez tyłów", "HDF", "karton", "tektura 1,5mm", "tektura 3mm"],
  },
  foam: {
    label: "Płyty piankowe",
    unit: "zł/m²",
    items: [
      "białe 3mm", "białe 5mm", "białe 10mm",
      "samoklejąca 3mm", "samoklejąca 5mm", "samoklejąca 10mm",
      "czarne 3mm", "czarne 5mm", "czarne 10mm",
    ],
  },
  passepartout: {
    label: "Passepartout",
    unit: "zł/m²",
    items: [
      "karton standard", "karton przekrój biały", "karton przekrój kolorowy",
      "karton metaliczne", "karton welurowe", "karton z tkaniną", "karton konserwatorski",
    ],
  },
  frame_price: {
    label: "Cena oprawy (flat fee)",
    unit: "zł",
    items: ["Opcja 1", "Opcja 2", "Opcja 3", "Opcja 4"],
  },
};

// --- Konwersja marży handlowej (procent) <-> mnożnik narzutu ---
// W bazie marża jest trzymana jako mnożnik (np. 2.0). W interfejsie
// wpisujemy ją jako marżę handlową w %, gdzie:
//   cena_netto_klienta = koszt_netto / (1 - B),  B = marża/100
// co odpowiada mnożnikowi  m = 1 / (1 - B).
// Przykłady: 50% -> 2.0,  37.5% -> 1.6,  45% -> ~1.818.
const MAX_MARGIN_PCT = 99; // limit bezpieczeństwa (B<100% by uniknąć dzielenia przez 0)

function pctToMult(pct) {
  let b = parseFloat(pct);
  if (!Number.isFinite(b) || b < 0) b = 0;
  if (b > MAX_MARGIN_PCT) b = MAX_MARGIN_PCT;
  return 1 / (1 - b / 100);
}

function multToPct(mult) {
  const m = parseFloat(mult);
  if (!Number.isFinite(m) || m <= 0) return "0";
  let pct = (1 - 1 / m) * 100;
  if (pct < 0) pct = 0;
  if (pct > MAX_MARGIN_PCT) pct = MAX_MARGIN_PCT;
  // czytelny zapis bez zbędnych zer (37.5, 50, 45)
  return String(parseFloat(pct.toFixed(2)));
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

function MaterialRow({ name, unit, showMargin, draft, onChange, onSave, saving, saved }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-stone-100 dark:border-stone-800/60 last:border-0">
      <span className="flex-1 text-sm" style={{ color: "var(--text)" }}>{name}</span>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.price}
            onChange={(e) => onChange("price", e.target.value)}
            className="input-field w-28 pr-10 text-right"
            placeholder="0.00"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: "var(--text-muted)" }}>
            {unit}
          </span>
        </div>
        {showMargin && (
          <div className="relative">
            <input
              type="number"
              min="0"
              max="99"
              step="1"
              value={draft.margin}
              onChange={(e) => onChange("margin", e.target.value)}
              className="input-field w-20 pr-6 text-right"
              placeholder="0"
              title="Marża handlowa, np. 50% → cena klienta = koszt / (1 − 0,50)"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: "var(--text-muted)" }}>
              %
            </span>
          </div>
        )}
        <button
          onClick={onSave}
          disabled={saving || saved}
          className={`text-xs flex items-center gap-1 px-2.5 py-1.5 shrink-0 rounded-lg transition-colors ${
            saved
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              : "btn-accent"
          }`}
          title="Zapisz"
        >
          {saving
            ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            : saved
              ? <CheckCircle size={11} />
              : <Save size={11} />}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { dbUser } = useAuth();

  const [form, setForm] = useState({
    company_name: "",
    address:      "",
    phone:        "",
    email:        "",
    website:      "",
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(false);

  // Dostawcy
  const [supplierConfigs, setSupplierConfigs] = useState([]);
  const [configsLoading,  setConfigsLoading]  = useState(true);
  const [configDrafts,    setConfigDrafts]    = useState({});
  const [savingConfig,    setSavingConfig]    = useState(null);

  // Materiały dodatkowe
  const [matDrafts,  setMatDrafts]  = useState({});
  const [savingMat,  setSavingMat]  = useState(null);
  const [savedMat,   setSavedMat]   = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/auth/me");
        if (data.settings) {
          setForm({
            company_name: data.settings.company_name ?? "",
            address:      data.settings.address      ?? "",
            phone:        data.settings.phone        ?? "",
            email:        data.settings.email        ?? "",
            website:      data.settings.website      ?? "",
          });
        }
      } catch {
        setError("Nie udało się pobrać ustawień.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    api.get("/auth/supplier-configs")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setSupplierConfigs(list);
        const drafts = {};
        list.forEach((s) => {
          if (s.config) {
            drafts[s.supplier_id] = {
              discount_pct: (s.config.discount * 100).toFixed(1),
              m_strip:      multToPct(s.config.m_strip),
              m_framed:     multToPct(s.config.m_framed),
            };
          }
        });
        setConfigDrafts(drafts);
      })
      .catch(() => {})
      .finally(() => setConfigsLoading(false));
  }, []);

  useEffect(() => {
    api.get("/materials")
      .then(({ data }) => {
        const drafts = {};
        (Array.isArray(data) ? data : []).forEach((m) => {
          const key = `${m.category}::${m.name}`;
          drafts[key] = { price: m.price, margin: multToPct(m.margin) };
        });
        setMatDrafts(drafts);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put("/auth/settings", form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zapisu ustawień.");
    } finally {
      setSaving(false);
    }
  };

  const update = (key) => (val) => setForm((prev) => ({ ...prev, [key]: val }));

  const toggleSupplier = async (s) => {
    setError(null);
    try {
      if (s.config) {
        await api.delete(`/auth/supplier-configs/${s.supplier_id}`);
        setSupplierConfigs((prev) =>
          prev.map((x) => x.supplier_id === s.supplier_id ? { ...x, config: null } : x)
        );
        setConfigDrafts((prev) => {
          const n = { ...prev };
          delete n[s.supplier_id];
          return n;
        });
      } else {
        const body = { discount: 0, m_strip: 1.6, m_framed: 2.0 };
        await api.put(`/auth/supplier-configs/${s.supplier_id}`, body);
        setSupplierConfigs((prev) =>
          prev.map((x) => x.supplier_id === s.supplier_id ? { ...x, config: body } : x)
        );
        setConfigDrafts((prev) => ({
          ...prev,
          [s.supplier_id]: {
            discount_pct: "0.0",
            m_strip:  multToPct(body.m_strip),
            m_framed: multToPct(body.m_framed),
          },
        }));
      }
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zmiany konfiguracji dostawcy.");
    }
  };

  const updateDraft = (supplierId, field, value) => {
    setConfigDrafts((prev) => ({
      ...prev,
      [supplierId]: { ...prev[supplierId], [field]: value },
    }));
  };

  const saveConfig = async (supplierId) => {
    const draft = configDrafts[supplierId];
    if (!draft) return;
    setSavingConfig(supplierId);
    setError(null);
    try {
      const body = {
        discount: parseFloat(draft.discount_pct) / 100,
        m_strip:  pctToMult(draft.m_strip),
        m_framed: pctToMult(draft.m_framed),
      };
      await api.put(`/auth/supplier-configs/${supplierId}`, body);
      setSupplierConfigs((prev) =>
        prev.map((x) => x.supplier_id === supplierId ? { ...x, config: body } : x)
      );
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zapisu konfiguracji dostawcy.");
    } finally {
      setSavingConfig(null);
    }
  };

  const updateMatDraft = (category, name, field, value) => {
    const key = `${category}::${name}`;
    setMatDrafts((prev) => ({
      ...prev,
      [key]: { price: 0, margin: "0", ...prev[key], [field]: value },
    }));
  };

  const saveMat = async (category, name) => {
    const key = `${category}::${name}`;
    const draft = matDrafts[key] ?? { price: 0, margin: "0" };
    setSavingMat(key);
    setError(null);
    try {
      await api.post("/materials/upsert", {
        name,
        category,
        price:  parseFloat(draft.price) || 0,
        margin: pctToMult(draft.margin),
      });
      setSavedMat(key);
      setTimeout(() => setSavedMat((prev) => (prev === key ? null : prev)), 2000);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zapisu materiału.");
    } finally {
      setSavingMat(null);
    }
  };

  return (
    <main className="min-h-screen pt-20 pb-28 md:pb-10 px-4 max-w-2xl mx-auto">
      {/* Nagłówek */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-accent-500/20">
          <Settings size={22} className="text-accent-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>Ustawienia</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Dane warsztatu i konta</p>
        </div>
      </div>

      {/* Konto */}
      <div className="glass-card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User size={15} className="text-accent-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Konto</h2>
          </div>
          {dbUser?.is_superadmin ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-500/20 border border-accent-500/30 text-accent-400 text-xs font-semibold">
              <ShieldCheck size={13} />
              Administrator
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-300 text-stone-600 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-400 text-xs">
              <User size={13} />
              Użytkownik
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between py-2 border-b border-stone-200 dark:border-stone-800">
            <span style={{ color: "var(--text-dim)" }}>Email</span>
            <span style={{ color: "var(--text)" }}>{dbUser?.email ?? "—"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-stone-200 dark:border-stone-800">
            <span style={{ color: "var(--text-dim)" }}>Status subskrypcji</span>
            <span className={dbUser?.is_paid ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"}>
              {dbUser?.is_paid ? "Aktywna" : "Trial"}
            </span>
          </div>
          {!dbUser?.is_paid && dbUser?.trial_expires && (
            <div className="flex justify-between py-2">
              <span style={{ color: "var(--text-dim)" }}>Trial wygasa</span>
              <span style={{ color: "var(--text)" }}>
                {new Date(dbUser.trial_expires).toLocaleDateString("pl-PL")}
              </span>
            </div>
          )}
        </div>

        {dbUser?.is_superadmin && (
          <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
            <Link
              to="/admin"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent-500/10 border border-accent-500/20 hover:bg-accent-500/20 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={15} className="text-accent-400" />
                <span className="text-sm text-accent-400 font-medium">Panel administratora</span>
              </div>
              <ExternalLink size={13} className="text-accent-500" />
            </Link>
          </div>
        )}
      </div>

      {/* Dane warsztatu */}
      <div className="glass-card p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Building size={15} className="text-accent-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Dane warsztatu</h2>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-stone-200 dark:bg-stone-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Nazwa firmy"      value={form.company_name} onChange={update("company_name")} placeholder="np. Pracownia Ramy Jan Kowalski" />
            <Field label="Adres"            value={form.address}      onChange={update("address")}      placeholder="ul. Przykładowa 1, 00-000 Warszawa" />
            <Field label="Telefon"          value={form.phone}        onChange={update("phone")}        placeholder="+48 000 000 000" />
            <Field label="Email kontaktowy" value={form.email}        onChange={update("email")}        type="email" placeholder="kontakt@warsztat.pl" />
            <Field label="Strona WWW"       value={form.website}      onChange={update("website")}      placeholder="www.mojwarsztat.pl" />
          </div>
        )}
      </div>

      {/* Dostawcy listew */}
      <div className="glass-card p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={15} className="text-accent-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Dostawcy listew
          </h2>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Aktywuj dostawców, z którymi współpracujesz, i ustaw swój indywidualny rabat oraz marże handlowe (w %).
          Cena klienta = koszt / (1 − marża) — przy 50% zysk równa się kosztowi surowca. VAT doliczany jest na końcu.
        </p>

        {configsLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-stone-200 dark:bg-stone-800 animate-pulse" />
            ))}
          </div>
        ) : supplierConfigs.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Brak dostawców. Administrator musi dodać dostawców w panelu administracyjnym.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {supplierConfigs.map((s) => {
              const draft = configDrafts[s.supplier_id];
              return (
                <div key={s.supplier_id} className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Building2 size={14} className="text-stone-400" />
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{s.supplier_name}</span>
                    </div>
                    <button
                      onClick={() => toggleSupplier(s)}
                      className={`text-xs px-3 py-1 rounded-full transition-colors ${
                        s.config
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-stone-200 text-stone-500 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-500 dark:hover:bg-stone-700"
                      }`}
                    >
                      {s.config ? "Aktywny" : "Nieaktywny"}
                    </button>
                  </div>

                  {s.config && draft && (
                    <div className="px-4 pb-4 pt-2 border-t border-stone-100 dark:border-stone-800/60">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="label">Rabat (%)</label>
                          <input
                            type="number"
                            min="0" max="50" step="0.5"
                            value={draft.discount_pct}
                            onChange={(e) => updateDraft(s.supplier_id, "discount_pct", e.target.value)}
                            className="input-field"
                          />
                        </div>
                        <div>
                          <label className="label">Marża listwa (%)</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0" max={MAX_MARGIN_PCT} step="1"
                              value={draft.m_strip}
                              onChange={(e) => updateDraft(s.supplier_id, "m_strip", e.target.value)}
                              className="input-field pr-7"
                              title="Marża handlowa, np. 50% → cena klienta = koszt / (1 − 0,50)"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: "var(--text-muted)" }}>%</span>
                          </div>
                        </div>
                        <div>
                          <label className="label">Marża rama (%)</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0" max={MAX_MARGIN_PCT} step="1"
                              value={draft.m_framed}
                              onChange={(e) => updateDraft(s.supplier_id, "m_framed", e.target.value)}
                              className="input-field pr-7"
                              title="Marża handlowa, np. 50% → cena klienta = koszt / (1 − 0,50)"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: "var(--text-muted)" }}>%</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => saveConfig(s.supplier_id)}
                        disabled={savingConfig === s.supplier_id}
                        className="btn-accent text-xs flex items-center gap-1.5 px-3 py-1.5"
                      >
                        {savingConfig === s.supplier_id
                          ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                          : <Save size={12} />}
                        Zapisz
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Materiały dodatkowe */}
      {Object.entries(MATERIAL_CATALOG).map(([category, { label, unit, items }]) => {
        const isFramePrice = category === "frame_price";
        return (
          <div key={category} className="glass-card p-5 mb-5">
            <div className="flex items-center gap-2 mb-1">
              <Package size={15} className="text-accent-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {label}
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              {isFramePrice
                ? "Stałe ceny oprawy (brutto). Wyświetlane jako przyciski w kalkulatorze — niewidoczne gdy cena = 0."
                : `Cena netto za m². Marża handlowa w %: cena klienta = koszt / (1 − marża), np. 50% = cena dwukrotnie wyższa od kosztu (na końcu doliczany VAT). Niewidoczne w kalkulatorze gdy cena = 0.`}
            </p>
            <div className="flex flex-col">
              {items.map((name) => {
                const key = `${category}::${name}`;
                const draft = matDrafts[key] ?? { price: 0, margin: "0" };
                return (
                  <MaterialRow
                    key={name}
                    name={name}
                    unit={unit}
                    showMargin={!isFramePrice}
                    draft={draft}
                    onChange={(field, value) => updateMatDraft(category, name, field, value)}
                    onSave={() => saveMat(category, name)}
                    saving={savingMat === key}
                    saved={savedMat === key}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Błąd / sukces */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-800/50 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 mb-4">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          <span>Ustawienia zapisane pomyślnie.</span>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || loading}
        className="btn-accent w-full flex items-center justify-center gap-2"
      >
        {saving
          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <Save size={16} />}
        {saving ? "Zapisuję…" : "Zapisz ustawienia warsztatu"}
      </button>
    </main>
  );
}
