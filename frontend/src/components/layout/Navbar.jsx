import { Link, useLocation } from "react-router-dom";
import { logout } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Calculator, BookOpen, Archive, Settings, LogOut, ShieldCheck, Sun, Moon, Monitor } from "lucide-react";

const links = [
  { to: "/",           icon: Calculator, label: "Kalkulator" },
  { to: "/cenniki",    icon: BookOpen,   label: "Cenniki"    },
  { to: "/zlecenia",   icon: Archive,    label: "Zlecenia"   },
  { to: "/ustawienia", icon: Settings,   label: "Ustawienia" },
];

const THEME_ICONS  = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABELS = { light: "Jasny", dark: "Ciemny", system: "Systemowy" };

export default function Navbar() {
  const { pathname } = useLocation();
  const { dbUser }   = useAuth();
  const { theme, cycleTheme } = useTheme();

  const ThemeIcon = THEME_ICONS[theme];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5 gap-1"
      style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
    >
      {/* Logo — wordmark */}
      <span
        className="text-sm font-semibold tracking-tight mr-5 shrink-0"
        style={{ color: "var(--text)" }}
      >
        Ramiarz Master
      </span>

      {/* Nawigacja — pełna tylko na desktopie (na telefonie linki są w dolnym pasku) */}
      <div className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
        {links.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                active
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              style={active ? undefined : { color: "var(--text-dim)" }}
            >
              <Icon size={13} />
              {label}
            </Link>
          );
        })}

        {dbUser?.is_superadmin && (
          <Link
            to="/admin"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
              pathname === "/admin"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            style={pathname === "/admin" ? undefined : { color: "var(--text-dim)" }}
          >
            <ShieldCheck size={13} />
            Admin
          </Link>
        )}
      </div>

      {/* Spacer na telefonie — wypycha akcje do prawej (linki są w dolnym pasku) */}
      <div className="flex-1 md:hidden" />

      {/* Ustawienia — tylko telefon (na desktopie jest w linkach powyżej) */}
      <Link
        to="/ustawienia"
        title="Ustawienia"
        className={`md:hidden flex items-center p-2 rounded-full transition-colors shrink-0 ${
          pathname === "/ustawienia"
            ? "bg-black text-white dark:bg-white dark:text-black"
            : "hover:bg-black/5 dark:hover:bg-white/5"
        }`}
        style={pathname === "/ustawienia" ? undefined : { color: "var(--text-muted)" }}
      >
        <Settings size={16} />
      </Link>

      {/* Motyw */}
      <button
        onClick={cycleTheme}
        title={`Motyw: ${THEME_LABELS[theme]}`}
        className="flex items-center p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        <ThemeIcon size={15} />
      </button>

      {/* Wyloguj */}
      <button
        onClick={logout}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        <LogOut size={13} />
        Wyloguj
      </button>
    </nav>
  );
}
