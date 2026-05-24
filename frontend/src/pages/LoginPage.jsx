import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithGoogle, loginWithEmail, registerWithEmail } from "../services/firebase";
import { Frame, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const navigate   = useNavigate();
  const [mode, setMode]         = useState("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleGoogle = async () => {
    setError(""); setLoading(true);
    try { await loginWithGoogle(); navigate("/"); }
    catch (e) { setError("Błąd logowania przez Google"); }
    finally { setLoading(false); }
  };

  const handleEmail = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      if (mode === "login") await loginWithEmail(email, password);
      else await registerWithEmail(email, password);
      navigate("/");
    } catch (e) {
      const msg = {
        "auth/invalid-credential":    "Nieprawidłowy email lub hasło",
        "auth/user-not-found":        "Konto nie istnieje",
        "auth/wrong-password":        "Nieprawidłowe hasło",
        "auth/email-already-in-use":  "Email jest już zajęty",
        "auth/weak-password":         "Hasło musi mieć min. 6 znaków",
        "auth/invalid-email":         "Nieprawidłowy format email",
      }[e.code] || "Wystąpił błąd — spróbuj ponownie";
      setError(msg);
    }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent-400/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-500/10 border border-accent-500/20 mb-4">
            <Frame className="text-accent-400" size={32} />
          </div>
          <h1 className="font-display text-3xl text-stone-100 mb-1">Ramiarz Master</h1>
          <p className="text-stone-500 text-sm">Profesjonalny kalkulator dla ramiarzy</p>
        </div>

        <div className="glass-card p-8">

          <button onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-stone-100 text-stone-800 font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 mb-6">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.826.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
            </svg>
            Zaloguj się przez Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-stone-800" />
            <span className="text-stone-600 text-xs">lub</span>
            <div className="flex-1 h-px bg-stone-800" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="label block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="twoj@email.pl" required
                  className="input-field pl-9" />
              </div>
            </div>

            <div>
              <label className="label block mb-1.5">Hasło</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input type={showPass ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  className="input-field pl-9 pr-10" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300">
                  {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-sm">
                <AlertCircle size={14} className="shrink-0" />{error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-accent w-full py-2.5 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                : mode === "login" ? "Zaloguj się" : "Utwórz konto"
              }
            </button>
          </form>

          <p className="text-center text-sm text-stone-500 mt-6">
            {mode === "login" ? "Nie masz konta? " : "Masz już konto? "}
            <button onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(""); }}
              className="text-accent-400 hover:text-accent-300 transition-colors">
              {mode === "login" ? "Zarejestruj się" : "Zaloguj się"}
            </button>
          </p>

        </div>

        <p className="text-center text-stone-700 text-xs mt-6">
          © 2026 EBRA · ramiarz.ebra.pl
        </p>
      </div>
    </div>
  );
}
