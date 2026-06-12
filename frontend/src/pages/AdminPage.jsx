import { useEffect, useState, useRef } from "react";
import {
  ShieldCheck, Users, AlertCircle, AlertTriangle,
  RefreshCw, Plus, Trash2, Upload, CheckCircle, Building2,
  Crown, UserCheck, UserX, FileSpreadsheet, Search, ChevronDown, ChevronUp,
  Mail, Send, X, Calendar, Megaphone,
} from "lucide-react";
import api from "../services/api";

// ─── Zakładki ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "users",     label: "Użytkownicy",      icon: Users },
  { id: "suppliers", label: "Producenci listew", icon: Building2 },
  { id: "adboxes",   label: "Reklamy",           icon: Megaphone },
];

// ─── Karta statystyki ─────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent = false }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`p-1.5 rounded-lg ${accent ? "bg-accent-500/20" : "bg-stone-900 dark:bg-stone-800"}`}>
          <Icon size={16} className={accent ? "text-accent-400" : "text-stone-300 dark:text-stone-400"} />
        </div>
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{label}</span>
      </div>
      <p className="text-2xl font-mono font-semibold" style={{ color: 'var(--text)' }}>{value ?? "—"}</p>
    </div>
  );
}

// ─── Wiersz użytkownika ───────────────────────────────────────────────────────
function UserRow({ u, selected, onSelect, onTogglePaid, onToggleAdmin, onEditSub }) {
  const trial = u.trial_expires
    ? new Date(u.trial_expires).toLocaleDateString("pl-PL")
    : "—";
  const created = u.created_at
    ? new Date(u.created_at).toLocaleDateString("pl-PL")
    : "—";
  const subExpires = u.subscription_expires
    ? new Date(u.subscription_expires).toLocaleDateString("pl-PL")
    : "—";
  const subLabel = u.subscription_plan === "monthly" ? "Miesięczny"
                 : u.subscription_plan === "yearly"  ? "Roczny"
                 : null;

  return (
    <tr className="border-b border-stone-200 dark:border-stone-800 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
      <td className="px-3 py-3 text-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(u.id)}
          className="accent-amber-500 cursor-pointer"
          aria-label={`Zaznacz ${u.email}`}
        />
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>
        <div className="flex items-center gap-2">
          {u.is_superadmin && (
            <Crown size={12} className="text-accent-400 shrink-0" title="Administrator" />
          )}
          <span>{u.email}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-center" style={{ color: 'var(--text-dim)' }}>{created}</td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onTogglePaid(u)}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${
            u.is_paid
              ? "bg-stone-900 text-white hover:bg-stone-700"
              : "bg-stone-200 text-stone-600 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-400 dark:hover:bg-stone-600"
          }`}
        >
          {u.is_paid ? "Aktywny" : "Trial"}
        </button>
      </td>
      <td className="px-4 py-3 text-xs text-center" style={{ color: 'var(--text-dim)' }}>
        {u.is_paid ? (
          <div className="flex flex-col items-center gap-0.5">
            {subLabel && <span className="text-accent-400 font-medium">{subLabel}</span>}
            <span>{subExpires}</span>
          </div>
        ) : trial}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onToggleAdmin(u)}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${
            u.is_superadmin
              ? "bg-stone-900 text-accent-400 hover:bg-stone-700"
              : "bg-stone-200 text-stone-600 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-500 dark:hover:bg-stone-600"
          }`}
        >
          {u.is_superadmin ? "Admin" : "Użytkownik"}
        </button>
      </td>
      <td className="px-3 py-3 text-center">
        <button
          onClick={() => onEditSub(u)}
          className="text-stone-400 hover:text-accent-400 transition-colors p-1 rounded"
          title="Edytuj subskrypcję"
        >
          <Calendar size={14} />
        </button>
      </td>
    </tr>
  );
}

// ─── Modal: wysyłka maili do użytkowników ─────────────────────────────────────
function EmailComposeModal({ selectedIds, onClose }) {
  const [target,     setTarget]     = useState(selectedIds.length > 0 ? "selected" : "all");
  const [suppliers,  setSuppliers]  = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [subject,    setSubject]    = useState("");
  const [body,       setBody]       = useState("");
  const [status,     setStatus]     = useState(null);
  const [sending,    setSending]    = useState(false);
  const [error,      setError]      = useState(null);
  const [result,     setResult]     = useState(null);

  useEffect(() => {
    api.get("/admin/email-status").then(({ data }) => setStatus(data)).catch(() => setStatus({ configured: false }));
    api.get("/admin/suppliers").then(({ data }) => setSuppliers(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const TARGETS = [
    { id: "selected", label: `Zaznaczeni (${selectedIds.length})`, disabled: selectedIds.length === 0 },
    { id: "all",      label: "Wszyscy",        disabled: false },
    { id: "paid",     label: "Z abonamentem",  disabled: false },
    { id: "supplier", label: "Wg producenta",  disabled: false },
  ];

  const canSend =
    !sending &&
    subject.trim() &&
    body.trim() &&
    (target !== "supplier" || supplierId) &&
    (target !== "selected" || selectedIds.length > 0);

  const send = async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const payload = { subject, body, target };
      if (target === "selected") payload.user_ids = selectedIds;
      if (target === "supplier") payload.supplier_id = supplierId ? Number(supplierId) : null;
      const { data } = await api.post("/admin/send-email", payload);
      setResult(data);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd wysyłki maili.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card p-6 w-full max-w-lg overflow-y-auto max-h-[92vh]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg flex items-center gap-2" style={{ color: "var(--text)" }}>
            <Mail size={18} className="text-accent-400" /> Wyślij mail
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
            <X size={18} />
          </button>
        </div>

        {status && !status.configured && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-800/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 mb-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>Wysyłka maili nie jest skonfigurowana (GMAIL_SENDER + konto serwisowe z delegacją domenową). Treść możesz przygotować, ale wysyłka się nie powiedzie.</span>
          </div>
        )}

        {result ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <p className="text-sm text-center" style={{ color: "var(--text)" }}>
              Wysłano <strong>{result.sent}</strong> z <strong>{result.total}</strong> maili.
            </p>
            {result.failed?.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                Nie dostarczono: {result.failed.join(", ")}
              </p>
            )}
            <button onClick={onClose} className="btn-accent text-sm mt-2">Zamknij</button>
          </div>
        ) : (
          <>
            <label className="label">Odbiorcy</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {TARGETS.map((t) => (
                <button
                  key={t.id}
                  disabled={t.disabled}
                  onClick={() => setTarget(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    target === t.id
                      ? "bg-accent-500/20 border-accent-500/40 text-accent-400"
                      : "border-stone-300 dark:border-stone-700 disabled:opacity-40"
                  }`}
                  style={target !== t.id ? { color: "var(--text-dim)" } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {target === "supplier" && (
              <div className="mb-3">
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="input-field"
                >
                  <option value="">— wybierz producenta —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="label">Temat</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="np. Nowy producent listew w ofercie"
                className="input-field"
              />
            </div>
            <div className="mb-4">
              <label className="label">Treść</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                placeholder="Treść wiadomości…"
                className="input-field resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mb-3">
                <AlertCircle size={14} /> <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost flex-1 text-sm">Anuluj</button>
              <button
                onClick={send}
                disabled={!canSend}
                className="btn-accent flex-1 flex items-center justify-center gap-2 text-sm"
              >
                {sending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Send size={14} />}
                {sending ? "Wysyłam…" : "Wyślij"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modal edycji subskrypcji ─────────────────────────────────────────────────
function SubscriptionModal({ user, onClose, onSaved }) {
  const [plan,    setPlan]    = useState(user.subscription_plan ?? "");
  const [expires, setExpires] = useState(
    user.subscription_expires
      ? new Date(user.subscription_expires).toISOString().slice(0, 10)
      : ""
  );
  const [saving, setSaving]  = useState(false);
  const [error,  setError]   = useState(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {};
      if (plan === "") {
        payload.clear_subscription = true;
      } else {
        payload.subscription_plan = plan;
        payload.subscription_expires = expires ? new Date(expires + "T23:59:59Z").toISOString() : null;
        payload.is_paid = true;
      }
      const { data } = await api.patch(`/admin/users/${user.id}`, payload);
      onSaved(data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zapisu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base flex items-center gap-2" style={{ color: "var(--text)" }}>
            <Calendar size={16} className="text-accent-400" />
            Subskrypcja
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>{user.email}</p>

        <label className="label">Plan</label>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="input-field mb-3">
          <option value="">— brak / Trial —</option>
          <option value="monthly">Miesięczny (15 zł)</option>
          <option value="yearly">Roczny (150 zł)</option>
        </select>

        {plan !== "" && (
          <>
            <label className="label">Data końca subskrypcji</label>
            <input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className="input-field mb-4"
            />
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mb-3">
            <AlertCircle size={14} /> <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Anuluj</button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-accent flex-1 flex items-center justify-center gap-2 text-sm"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <CheckCircle size={14} />}
            {saving ? "Zapisuję…" : "Zapisz"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Zakładka: Użytkownicy ────────────────────────────────────────────────────
function TabUsers() {
  const [users,    setUsers]    = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [selected, setSelected] = useState([]);   // id zaznaczonych użytkowników
  const [showMail, setShowMail] = useState(false);
  const [subModal, setSubModal] = useState(null); // user object lub null

  const toggleSelect = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const allSelected = users.length > 0 && selected.length === users.length;
  const toggleSelectAll = () =>
    setSelected(allSelected ? [] : users.map((u) => u.id));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, sRes] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/stats"),
      ]);
      setUsers(Array.isArray(uRes.data) ? uRes.data : []);
      setStats(sRes.data);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd pobierania danych.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const togglePaid = async (u) => {
    try {
      const { data } = await api.patch(`/admin/users/${u.id}`, { is_paid: !u.is_paid });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data : x)));
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zmiany statusu.");
    }
  };

  const toggleAdmin = async (u) => {
    try {
      const { data } = await api.patch(`/admin/users/${u.id}`, { is_superadmin: !u.is_superadmin });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data : x)));
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zmiany roli.");
    }
  };

  const handleSubSaved = (updated) => {
    setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Wszyscy"   value={stats?.total_users} />
        <StatCard icon={UserCheck}   label="Abonament" value={stats?.paid_users}  accent />
        <StatCard icon={UserX}       label="Trial"     value={stats?.trial_users} />
        <StatCard icon={ShieldCheck} label="Admini"    value={stats?.admins} />
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-stone-700">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
            Lista użytkowników
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMail(true)}
              className="btn-accent text-xs flex items-center gap-1.5 px-3 py-1.5"
              title="Wyślij mail do użytkowników"
            >
              <Mail size={13} />
              Wyślij mail{selected.length > 0 ? ` (${selected.length})` : ""}
            </button>
            <button onClick={load} disabled={loading}
              className="btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Odśwież
            </button>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-800">
              <th className="px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="accent-amber-500 cursor-pointer"
                  aria-label="Zaznacz wszystkich"
                />
              </th>
              {["Email", "Dołączył", "Status", "Plan / Trial do", "Rola", ""].map((h, i) => (
                <th key={i} className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 0 ? "text-left" : "text-center"}`}
                  style={{ color: 'var(--text-dim)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-stone-200 dark:border-stone-800">
                  {[5, 50, 20, 15, 20, 15, 5].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-stone-200 dark:bg-stone-800 animate-pulse" style={{ width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length > 0 ? (
              users.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  selected={selected.includes(u.id)}
                  onSelect={toggleSelect}
                  onTogglePaid={togglePaid}
                  onToggleAdmin={toggleAdmin}
                  onEditSub={(u) => setSubModal(u)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
                  Brak użytkowników.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showMail && (
        <EmailComposeModal
          selectedIds={selected}
          onClose={() => setShowMail(false)}
        />
      )}

      {subModal && (
        <SubscriptionModal
          user={subModal}
          onClose={() => setSubModal(null)}
          onSaved={handleSubSaved}
        />
      )}
    </div>
  );
}

// ─── Profile producenta — oznaczanie wycofanych z produkcji ───────────────────
function SupplierMouldings({ supplierId }) {
  const [mouldings, setMouldings] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState("");
  const [error,     setError]     = useState(null);
  const [savingId,  setSavingId]  = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get("/mouldings", { params: { supplier_id: supplierId } })
      .then(({ data }) => { if (active) setMouldings(Array.isArray(data) ? data : []); })
      .catch((e) => { if (active) setError(e?.response?.data?.detail ?? "Błąd pobierania profili."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [supplierId]);

  const toggle = async (m) => {
    setSavingId(m.id);
    setError(null);
    try {
      const { data } = await api.patch(`/mouldings/${m.id}`, { discontinued: !m.discontinued });
      setMouldings((prev) => prev.map((x) => (x.id === m.id ? data : x)));
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zmiany statusu profilu.");
    } finally {
      setSavingId(null);
    }
  };

  const filtered = mouldings.filter((m) =>
    m.code?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800">
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
        <input
          type="text"
          placeholder="Szukaj profilu po kodzie…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-field pl-9 text-sm"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs mb-2">
          <AlertCircle size={13} /> <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded-lg bg-stone-200 dark:bg-stone-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs py-3 text-center" style={{ color: 'var(--text-dim)' }}>
          {query ? "Brak profili dla podanej frazy." : "Brak profili — wgraj cennik powyżej."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
          {filtered.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-sm truncate" style={{ color: 'var(--text)' }}>{m.code}</span>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-dim)' }}>{m.width_mm} mm</span>
              </div>
              <button
                onClick={() => toggle(m)}
                disabled={savingId === m.id}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full shrink-0 transition-colors ${
                  m.discontinued
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-stone-200 text-stone-600 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
                }`}
                title={m.discontinued ? "Kliknij, aby oznaczyć jako produkowaną" : "Kliknij, aby oznaczyć jako wycofaną"}
              >
                {savingId === m.id
                  ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  : m.discontinued && <AlertTriangle size={11} />}
                {m.discontinued ? "Wycofana" : "Produkowana"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Zakładka: Producenci listew ──────────────────────────────────────────────
function TabSuppliers() {
  const [suppliers,      setSuppliers]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState(null);
  const [newName,        setNewName]        = useState("");
  const [uploadTargetId, setUploadTargetId] = useState(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadResults,  setUploadResults]  = useState({});
  const [expandedId,     setExpandedId]     = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/suppliers");
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd pobierania producentów.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addSupplier = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post("/admin/suppliers", { name });
      setSuppliers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd dodawania producenta.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSupplier = async (id) => {
    try {
      await api.delete(`/admin/suppliers/${id}`);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      setUploadResults((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd usuwania producenta.");
    }
  };

  const handleUploadClick = (supplierId) => {
    setUploadTargetId(supplierId);
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    const targetId = uploadTargetId;
    if (!file || !targetId) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplier_id", String(targetId));
      const { data } = await api.post("/admin/mouldings/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadResults((prev) => ({ ...prev, [targetId]: data }));
      load();
    } catch (err) {
      setError(err?.response?.data?.detail ?? "Błąd importu cennika.");
    } finally {
      setUploading(false);
      setUploadTargetId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Format CSV — informacja */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet size={16} className="text-accent-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
            Obsługiwane formaty CSV
          </h2>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5 text-accent-400">
          Format Eurorama (wykrywany automatycznie)
        </p>
        <div className="rounded-lg bg-stone-100 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 p-3 font-mono text-xs text-stone-600 dark:text-stone-400 mb-3">
          <p className="text-stone-400 dark:text-stone-500 mb-1"># Oryginalny cennik Eurorama — wgraj bez zmian:</p>
          <p>kolumna 1;kolumna 2;kolumna 3;kolumna 4;kolumna 5</p>
          <p>Profil listwy;mb w paczce;Cena listew/mb;Cena ramy/mb;szerokość cm</p>
          <p className="text-emerald-600 dark:text-emerald-400">3484;;27;54;4,9</p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-dim)' }}>
          Format standardowy
        </p>
        <div className="rounded-lg bg-stone-100 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 p-3 font-mono text-xs text-stone-600 dark:text-stone-400">
          <p className="text-stone-400 dark:text-stone-500 mb-1"># Wymagane kolumny (separator , lub ;):</p>
          <p className="text-emerald-600 dark:text-emerald-400">code,price_strip,price_framed,width_mm</p>
          <p className="text-stone-400 dark:text-stone-600 mt-1"># Przykład:</p>
          <p>AR-001,12.50,18.00,40</p>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Szerokość: Eurorama w cm (×10→mm), standardowy w mm. Kodowanie UTF-8 lub Windows-1250.
          Import wykonuje <strong style={{ color: 'var(--text)' }}>upsert</strong>.
        </p>
      </div>

      {/* Dodaj producenta */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-dim)' }}>
          Dodaj producenta
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSupplier()}
            placeholder="Nazwa producenta / dostawcy listew…"
            className="input-field flex-1"
          />
          <button
            onClick={addSupplier}
            disabled={saving || !newName.trim()}
            className="btn-accent flex items-center gap-2"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Plus size={15} />}
            Dodaj
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista producentów */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-700">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
            Producenci ({suppliers.length})
          </h2>
        </div>
        {loading ? (
          <div className="p-4 flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-stone-200 dark:bg-stone-800 animate-pulse" />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
            Brak producentów — dodaj pierwszego powyżej.
          </div>
        ) : (
          <ul className="divide-y divide-stone-200 dark:divide-stone-800">
            {suppliers.map((s) => {
              const res = uploadResults[s.id];
              const isUploading = uploading && uploadTargetId === s.id;
              return (
                <li key={s.id} className="px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Building2 size={14} className="text-stone-400" />
                      <span className="text-sm" style={{ color: 'var(--text)' }}>{s.name}</span>
                      {s.moulding_count > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle size={11} />
                          Aktywny
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedId((prev) => (prev === s.id ? null : s.id))}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-700 hover:border-accent-500/40 hover:text-accent-400 transition-colors"
                        style={{ color: 'var(--text-dim)' }}
                        title="Zarządzaj profilami (wycofane z produkcji)"
                      >
                        {expandedId === s.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        Profile
                      </button>
                      <button
                        onClick={() => handleUploadClick(s.id)}
                        disabled={uploading}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-700 hover:border-accent-500/40 hover:text-accent-400 transition-colors"
                        style={{ color: 'var(--text-dim)' }}
                        title="Wgraj cennik CSV"
                      >
                        {isUploading
                          ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          : <Upload size={12} />}
                        Wgraj cennik
                      </button>
                      <button
                        onClick={() => deleteSupplier(s.id)}
                        className="text-stone-400 hover:text-red-500 transition-colors p-1 rounded"
                        title="Usuń producenta"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {expandedId === s.id && <SupplierMouldings supplierId={s.id} />}
                  {res && (
                    <div className="mt-1.5 flex items-center gap-3 text-xs pl-6">
                      <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {res.imported} nowych profili, {res.updated} zaktualizowanych
                      </span>
                      {res.errors?.length > 0 && (
                        <span className="text-amber-500">
                          {res.errors.length} pominięte
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Zakładka: Reklamy (boxy) ─────────────────────────────────────────────────
const AD_SLOTS = [
  { slot: "calculator", label: "Kalkulator" },
  { slot: "help",       label: "Pomoc" },
];

function AdBoxEditor({ slot, label }) {
  const [data,    setData]    = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [saved,   setSaved]   = useState(false);

  // pola formularza
  const [isActive,   setIsActive]   = useState(true);
  const [title,      setTitle]      = useState("");
  const [body,       setBody]       = useState("");
  const [linkUrl,    setLinkUrl]    = useState("");
  const [linkLabel,  setLinkLabel]  = useState("");
  const [bgColor,    setBgColor]    = useState("");
  const [customHtml, setCustomHtml] = useState("");

  useEffect(() => {
    api.get(`/adboxes/${slot}`)
      .then(({ data: d }) => {
        setData(d);
        setIsActive(d.is_active ?? true);
        setTitle(d.title ?? "");
        setBody(d.body ?? "");
        setLinkUrl(d.link_url ?? "");
        setLinkLabel(d.link_label ?? "");
        setBgColor(d.bg_color ?? "");
        setCustomHtml(d.custom_html ?? "");
      })
      .catch(() => {}); // brak boxu — puste pola
  }, [slot]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.put(`/adboxes/${slot}`, {
        is_active:   isActive,
        title:       title   || null,
        body:        body    || null,
        link_url:    linkUrl || null,
        link_label:  linkLabel || null,
        bg_color:    bgColor || null,
        custom_html: customHtml || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zapisu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2" style={{ color: "var(--text-dim)" }}>
          <Megaphone size={14} className="text-accent-400" />
          Box: {label}
        </h3>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>Aktywny</span>
          <div
            onClick={() => setIsActive((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${isActive ? "bg-accent-500" : "bg-stone-400 dark:bg-stone-700"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Tytuł</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="np. Promocja dla zakładów…" />
        </div>
        <div>
          <label className="label">Kolor tła (hex, opcjonalne)</label>
          <div className="flex items-center gap-2">
            <input type="color" value={bgColor || "#ffffff"} onChange={(e) => setBgColor(e.target.value)}
              className="w-10 h-9 rounded border border-stone-300 dark:border-stone-700 cursor-pointer bg-transparent p-0.5" />
            <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
              className="input-field flex-1" placeholder="#1a1a2e lub puste = domyślne" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Treść (krótki opis)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="input-field resize-none" placeholder="Kilka zdań opisu…" />
        </div>
        <div>
          <label className="label">URL linku</label>
          <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="input-field" placeholder="https://…" />
        </div>
        <div>
          <label className="label">Etykieta linku</label>
          <input type="text" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} className="input-field" placeholder="np. Sprawdź ofertę" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Zewnętrzny HTML (AdSense / własny kod — nadpisuje treść statyczną)</label>
          <textarea value={customHtml} onChange={(e) => setCustomHtml(e.target.value)} rows={4} className="input-field font-mono text-xs resize-y" placeholder="<script>…</script> lub <ins class='adsbygoogle'…>" />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={14} /> <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-accent flex items-center gap-2 text-sm">
          {saving
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <CheckCircle size={14} />}
          {saving ? "Zapisuję…" : "Zapisz"}
        </button>
        {saved && <span className="text-xs text-emerald-500">✓ Zapisano</span>}
      </div>
    </div>
  );
}

function TabAdBoxes() {
  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {AD_SLOTS.map(({ slot, label }) => (
        <AdBoxEditor key={slot} slot={slot} label={label} />
      ))}
    </div>
  );
}

// ─── Strona główna admina ─────────────────────────────────────────────────────
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <main className="min-h-screen pt-20 pb-28 md:pb-10 px-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-accent-500/20">
          <ShieldCheck size={22} className="text-accent-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text)' }}>Panel administratora</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>Zarządzanie aplikacją i użytkownikami</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors
              ${activeTab === id
                ? "bg-accent-500/20 text-accent-400 font-medium"
                : "hover:bg-black/10 dark:hover:bg-stone-800/60"}`}
            style={activeTab !== id ? { color: 'var(--text-dim)' } : {}}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "users"     && <TabUsers />}
      {activeTab === "suppliers" && <TabSuppliers />}
      {activeTab === "adboxes"   && <TabAdBoxes />}
    </main>
  );
}
