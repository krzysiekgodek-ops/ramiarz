import { Link, useLocation, useNavigate } from "react-router-dom";
import { Calculator, BookOpen, Archive, Plus } from "lucide-react";

// Zakładki dolnego paska (tylko telefon/tablet). Ustawienia + motyw + wyloguj są w górnym pasku.
const tabs = [
  { to: "/",         icon: Calculator, label: "Kalkulator" },
  { to: "/cenniki",  icon: BookOpen,   label: "Cennik"     },
  { to: "/zlecenia", icon: Archive,    label: "Zlecenia"   },
];

function Tab({ to, icon: Icon, label, active }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
      style={{ color: active ? "var(--text)" : "var(--text-muted)" }}
    >
      <Icon size={20} className={active ? "text-accent-400" : ""} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Przycisk „+" zawsze otwiera świeżą wycenę — nawet gdy już jesteśmy w kalkulatorze.
  const newQuote = () => navigate("/", { state: { newQuote: Date.now() } });

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        backgroundColor: "var(--bg-card)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="relative flex items-stretch h-16">
        {/* Lewa grupa: Kalkulator + Cennik */}
        <div className="flex flex-1">
          <Tab {...tabs[0]} active={pathname === tabs[0].to} />
          <Tab {...tabs[1]} active={pathname === tabs[1].to} />
        </div>

        {/* Środek — miejsce zarezerwowane na wyniesiony przycisk + */}
        <div className="w-20 shrink-0" aria-hidden="true" />

        {/* Prawa grupa: Zlecenia */}
        <div className="flex flex-1">
          <Tab {...tabs[2]} active={pathname === tabs[2].to} />
        </div>

        {/* FAB — nowa wycena */}
        <button
          type="button"
          onClick={newQuote}
          title="Nowa wycena"
          aria-label="Nowa wycena"
          className="absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-14 rounded-full flex items-center justify-center bg-accent-500 shadow-lg shadow-accent-500/30 ring-4 active:scale-95 transition-transform"
          style={{ "--tw-ring-color": "var(--bg)" }}
        >
          <Plus size={26} className="text-white" strokeWidth={2.5} />
        </button>
      </div>
    </nav>
  );
}
