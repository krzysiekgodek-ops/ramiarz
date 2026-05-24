import { useEffect, useState } from "react";
import { BookOpen, Plus, Search, AlertCircle, Package } from "lucide-react";
import api from "../services/api";

// ─── Wiersz tabeli profilu ────────────────────────────────────────────────────
function MouldingRow({ m }) {
  return (
    <tr className="border-b border-stone-200 dark:border-stone-800 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
      <td className="px-4 py-3 font-mono text-sm" style={{ color: 'var(--text)' }}>{m.code}</td>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-dim)' }}>{m.supplier_name ?? "—"}</td>
      <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: 'var(--text)' }}>
        {m.price_strip?.toFixed(2)} zł
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: 'var(--text)' }}>
        {m.price_framed?.toFixed(2)} zł
      </td>
      <td className="px-4 py-3 text-right text-sm" style={{ color: 'var(--text-dim)' }}>{m.width_mm} mm</td>
    </tr>
  );
}

// ─── Szkielet ładowania ───────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-stone-200 dark:border-stone-800">
      {[40, 60, 30, 30, 20].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-stone-200 dark:bg-stone-800 animate-pulse" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function MouldingsPage() {
  const [mouldings, setMouldings] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [query, setQuery]         = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/mouldings");
        setMouldings(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e?.response?.data?.detail ?? "Nie udało się pobrać cenników.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = mouldings.filter((m) =>
    m.code?.toLowerCase().includes(query.toLowerCase()) ||
    m.supplier_name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="min-h-screen pt-20 pb-10 px-4 max-w-5xl mx-auto">
      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent-500/20">
            <BookOpen size={22} className="text-accent-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text)' }}>Cenniki listew</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>
              {!loading && `${mouldings.length} profili w bazie`}
            </p>
          </div>
        </div>
        <button className="btn-accent flex items-center gap-2 text-sm">
          <Plus size={15} />
          Dodaj profil
        </button>
      </div>

      {/* Wyszukiwarka */}
      <div className="glass-card p-4 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="Szukaj po kodzie lub dostawcy…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Błąd */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabela */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-700">
              {["Kod", "Dostawca", "Cena / mb", "Cena oprawiona", "Szerokość"].map((h, i) => (
                <th key={h}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i < 2 ? "text-left" : "text-right"}`}
                  style={{ color: 'var(--text-dim)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)
              : filtered.length > 0
                ? filtered.map((m) => <MouldingRow key={m.id} m={m} />)
                : (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <Package size={32} className="mx-auto mb-3 text-stone-400 dark:text-stone-700" />
                      <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                        {query ? "Brak wyników dla podanej frazy." : "Brak profili — dodaj pierwszy cennik."}
                      </p>
                    </td>
                  </tr>
                )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
