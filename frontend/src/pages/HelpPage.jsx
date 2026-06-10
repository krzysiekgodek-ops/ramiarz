import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import {
  HelpCircle, Plus, Edit3, Trash2, X, Save, AlertCircle, ChevronDown,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import RichTextEditor from "../components/RichTextEditor";

// Style treści (spójne z edytorem)
const HELP_CONTENT_STYLES = `
  .help-content h1 { font-size: 1.25rem; font-weight: 800; margin: 1rem 0 0.5rem; color: var(--text); }
  .help-content h2 { font-size: 1.05rem; font-weight: 700; margin: 0.875rem 0 0.375rem; color: var(--text); }
  .help-content p { margin-bottom: 0.5rem; line-height: 1.75; color: var(--text); }
  .help-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
  .help-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
  .help-content li { margin-bottom: 0.25rem; color: var(--text); line-height: 1.6; }
  .help-content strong { font-weight: 700; }
  .help-content em { font-style: italic; }
  .help-content u { text-decoration: underline; }
  .help-content [style*="text-align: center"] { text-align: center; }
  .help-content [style*="text-align: right"] { text-align: right; }
`;

// ─── Modal edycji (admin) ─────────────────────────────────────────────────────
function EditModal({ initial, onClose, onSaved }) {
  const [title, setTitle]     = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = { title: title.trim(), content };
      const { data } = initial?.id
        ? await api.put(`/help/${initial.id}`, body)
        : await api.post("/help", body);
      onSaved(data, !initial?.id);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd zapisu artykułu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card p-6 w-full max-w-2xl overflow-y-auto max-h-[92vh]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg" style={{ color: "var(--text)" }}>
            {initial?.id ? "Edytuj artykuł" : "Nowy artykuł"}
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Tytuł</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Pierwsze uruchomienie"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Treść</label>
            <RichTextEditor value={content} onChange={setContent} placeholder="Napisz instrukcję krok po kroku…" />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mt-3">
            <AlertCircle size={14} /> <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Anuluj</button>
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="btn-accent flex-1 flex items-center justify-center gap-2 text-sm"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save size={14} />}
            {saving ? "Zapisuję…" : "Zapisz"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pojedynczy artykuł (rozwijany) ───────────────────────────────────────────
function Article({ article, isAdmin, expanded, onToggle, onEdit, onDelete }) {
  const safe = DOMPurify.sanitize(article.content || "");
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={onToggle} className="flex items-center gap-2.5 flex-1 text-left min-w-0">
          <ChevronDown
            size={16}
            className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            style={{ color: "var(--text-dim)" }}
          />
          <span className="font-medium truncate" style={{ color: "var(--text)" }}>{article.title}</span>
        </button>
        {isAdmin && (
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              onClick={() => onEdit(article)}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: "var(--text-dim)" }}
              title="Edytuj"
            >
              <Edit3 size={15} />
            </button>
            <button
              onClick={() => onDelete(article)}
              className="p-2 rounded-lg text-stone-400 hover:text-red-500 transition-colors"
              title="Usuń"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-stone-100 dark:border-stone-800/60">
          {safe ? (
            <div className="help-content text-sm mt-3" dangerouslySetInnerHTML={{ __html: safe }} />
          ) : (
            <p className="text-sm italic mt-3" style={{ color: "var(--text-dim)" }}>Brak treści.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Strona ───────────────────────────────────────────────────────────────────
export default function HelpPage() {
  const { dbUser } = useAuth();
  const isAdmin = !!dbUser?.is_superadmin;

  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [editing, setEditing]   = useState(null); // {id?...} lub {} dla nowego

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/help");
      const list = Array.isArray(data) ? data : [];
      setArticles(list);
      if (list.length > 0) setExpandedId((prev) => prev ?? list[0].id);
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Nie udało się pobrać treści pomocy.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSaved = (saved, isNew) => {
    setArticles((prev) =>
      isNew ? [...prev, saved] : prev.map((a) => (a.id === saved.id ? saved : a))
    );
    setExpandedId(saved.id);
    setEditing(null);
  };

  const handleDelete = async (article) => {
    if (!window.confirm(`Usunąć artykuł „${article.title}"?`)) return;
    try {
      await api.delete(`/help/${article.id}`);
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Błąd usuwania artykułu.");
    }
  };

  return (
    <main className="min-h-screen pt-20 pb-28 md:pb-10 px-4 max-w-2xl mx-auto">
      <style>{HELP_CONTENT_STYLES}</style>

      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent-500/20">
            <HelpCircle size={22} className="text-accent-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>Pomoc</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Instrukcja obsługi krok po kroku</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditing({})}
            className="btn-accent flex items-center gap-2 text-sm shrink-0"
          >
            <Plus size={15} />
            Dodaj
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-3xl bg-stone-200 dark:bg-stone-800 animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <HelpCircle size={32} className="mx-auto mb-3 text-stone-400 dark:text-stone-700" />
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            {isAdmin ? "Brak treści — dodaj pierwszy artykuł pomocy." : "Treści pomocy pojawią się wkrótce."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {articles.map((a) => (
            <Article
              key={a.id}
              article={a}
              isAdmin={isAdmin}
              expanded={expandedId === a.id}
              onToggle={() => setExpandedId((prev) => (prev === a.id ? null : a.id))}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}
