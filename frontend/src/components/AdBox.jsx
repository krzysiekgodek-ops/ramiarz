import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import api from "../services/api";

export default function AdBox({ slot }) {
  const [box, setBox] = useState(null);

  useEffect(() => {
    api.get(`/adboxes/${slot}`)
      .then(({ data }) => setBox(data))
      .catch(() => setBox(null));
  }, [slot]);

  if (!box) return null;

  // Tryb zewnętrznego HTML (AdSense itp.)
  if (box.custom_html) {
    return (
      <div
        className="w-full rounded-2xl overflow-hidden"
        style={{ minHeight: "120px" }}
        dangerouslySetInnerHTML={{ __html: box.custom_html }}
      />
    );
  }

  // Tryb statyczny
  const bg = box.bg_color ?? "var(--glass-bg)";

  return (
    <div
      className="w-full rounded-2xl px-5 py-4 flex flex-col justify-between gap-2 border border-stone-200 dark:border-stone-700/50"
      style={{ background: bg, minHeight: "120px" }}
    >
      {box.title && (
        <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>
          {box.title}
        </p>
      )}
      {box.body && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
          {box.body}
        </p>
      )}
      {box.link_url && (
        <a
          href={box.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start flex items-center gap-1.5 text-xs font-medium text-accent-400 hover:text-accent-300 transition-colors mt-1"
        >
          {box.link_label ?? "Dowiedz się więcej"}
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}
