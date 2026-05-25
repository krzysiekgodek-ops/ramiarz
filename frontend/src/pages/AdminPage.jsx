import { useEffect, useState, useRef } from "react";
import {
  ShieldCheck, Users, AlertCircle,
  RefreshCw, Plus, Trash2, Upload, CheckCircle, Building2,
  Crown, UserCheck, UserX, FileSpreadsheet,
} from "lucide-react";
import api from "../services/api";

// ─── Zakładki ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "users",     label: "Użytkownicy",      icon: Users },
  { id: "suppliers", label: "Producenci listew", icon: Building2 },
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
function UserRow({ u, onTogglePaid, onToggleAdmin }) {
  const trial = u.trial_expires
    ? new Date(u.trial_expires).toLocaleDateString("pl-PL")
    : "—";
  const created = u.created_at
    ? new Date(u.created_at).toLocaleDateString("pl-PL")
    : "—";

  return (
    <tr className="border-b border-stone-200 dark:border-stone-800 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
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
        {u.is_paid ? "—" : trial}
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
    </tr>
  );
}

// ─── Zakładka: Użytkownicy ────────────────────────────────────────────────────
function TabUsers() {
  const [users,   setUsers]   = useState([]);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

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
          <button onClick={load} disabled={loading}
            className="btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Odśwież
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-800">
              {["Email", "Dołączył", "Status", "Trial do", "Rola"].map((h, i) => (
                <th key={h} className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 0 ? "text-left" : "text-center"}`}
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
                  {[50, 20, 15, 20, 15].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-stone-200 dark:bg-stone-800 animate-pulse" style={{ width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length > 0 ? (
              users.map((u) => (
                <UserRow key={u.id} u={u} onTogglePaid={togglePaid} onToggleAdmin={toggleAdmin} />
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
                  Brak użytkowników.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
    </main>
  );
}
