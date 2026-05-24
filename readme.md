# Ramiarz Master — Stan projektu
**Data:** 18 maja 2026  
**Sesja:** Architektura + setup Moduł 1 → ukończony, M2 gotowy do budowania

---

## 1. Decyzje architektoniczne

### Stack technologiczny (zatwierdzone)

| Warstwa | Technologia | Uzasadnienie |
|---|---|---|
| Frontend | React + Vite 5 + Tailwind CSS 3 | Spójny z EBRA (Masarski/Piekarski) |
| Backend | FastAPI (Python) + SQLAlchemy | Zachowanie logiki kalkulatora, SQLAlchemy ORM |
| Baza danych (lokalnie) | SQLite (dev.db) | Szybki start bez konfiguracji |
| Baza danych (produkcja) | PostgreSQL na MyDevil.net | Wielodostęp, backup, brak limitów |
| Auth | Firebase Authentication | Gmail OAuth + email/hasło |
| Hosting | MyDevil.net (Passenger WSGI) | Istniejące konto, Python+Node support |
| Płatności | Stripe Payment Links | Jak Masarski Master |
| Email | SendGrid lub SMTP MyDevil | 100 maili/dzień gratis |
| SMS | SMSAPI.pl | Polski operator, ~0.09 zł/SMS |
| Firebase projekt | masarski-pro-v2 | Wspólny z innymi kalkulatorami EBRA |

### Zmiana modelu auth (kluczowa)
- **Usunięto:** `hashed_password` z tabeli `users`  
- **Dodano:** `firebase_uid` (String, unique, index) — Firebase przejmuje całą obsługę auth
- Użytkownicy tworzone auto przy pierwszym logowaniu (upsert w `get_current_user`)

---

## 2. Struktura projektu

```
D:\DEV\APLIKACJE\ramiarz-master\
├── readme.md
├── .gitignore                          ✅ gotowy (chroni sekrety Firebase)
├── secret/                             🔒 POZA GIT — service account Firebase
│
├── frontend/                    ← React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/
│   │   │       └── Navbar.jsx          ✅ gotowy
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx           ✅ gotowy (pełny UI)
│   │   │   ├── CalculatorPage.jsx      ✅ gotowy (formularz + panel wyników)
│   │   │   ├── MouldingsPage.jsx       ✅ gotowy (tabela + wyszukiwarka)
│   │   │   ├── OrdersPage.jsx          ✅ gotowy (tabela + statystyki)
│   │   │   ├── SettingsPage.jsx        ✅ gotowy (formularz warsztatu + konto)
│   │   │   └── AdminPage.jsx           ✅ gotowy (panel admina + użytkownicy)
│   │   ├── hooks/
│   │   │   ├── useAuth.js              ✅ gotowy (re-export z AuthContext)
│   │   │   └── useCalculator.js        ✅ gotowy (stan formularza + wywołanie API)
│   │   ├── services/
│   │   │   ├── firebase.js             ✅ gotowy
│   │   │   └── api.js                  ✅ gotowy (axios + interceptor)
│   │   ├── context/
│   │   │   └── AuthContext.jsx         ✅ gotowy
│   │   ├── App.jsx                     ✅ gotowy (routing)
│   │   ├── main.jsx                    ✅ gotowy
│   │   └── index.css                   ✅ gotowy (Tailwind + CSS vars)
│   ├── tailwind.config.js              ✅ gotowy (akcent złoty)
│   ├── vite.config.js                  ✅ gotowy (proxy → :8000)
│   ├── .env                            ✅ gotowy (Firebase masarski-pro-v2)
│   └── package.json                    ✅ wszystkie paczki zainstalowane
│
└── backend/                     ← FastAPI REST API
    ├── app/
    │   ├── models/
    │   │   └── models.py               ✅ gotowy + firebase_uid
    │   ├── schemas/
    │   │   └── schemas.py              ✅ gotowy
    │   ├── services/
    │   │   ├── calculator_service.py   ✅ gotowy (logika wyceny)
    │   │   └── pricing_service.py      ✅ gotowy (VAT=1.23 hardcoded — TODO)
    │   ├── routes/
    │   │   ├── auth.py                 ✅ GET /api/auth/me + PUT /api/auth/settings
    │   │   ├── calculator.py           ✅ GET /ping + POST /calculate (pełna wycena)
    │   │   ├── orders.py               ✅ GET + POST + DELETE /api/orders
    │   │   ├── mouldings.py            ✅ GET + POST /api/mouldings
    │   │   ├── materials.py            ✅ GET + POST + DELETE /api/materials
    │   │   └── admin.py                ✅ GET + PATCH /api/admin/users
    │   ├── database.py                 ✅ SQLite/PostgreSQL switcher
    │   ├── main.py                     ✅ FastAPI app + CORS + routery
    │   └── dependencies.py             ✅ Firebase JWT verify + get_current_user
    ├── firebase_service_account.json   ✅ pobrane z Firebase Console (poza git)
    ├── requirements.txt                ✅
    ├── .env                            ✅ (SQLite dev, CORS ports :5173 + :5174)
    └── venv/                           ✅ Python 3.14 venv
```

---

## 3. Design system (frontend)

### Kolory akcentu — ciepłe złoto (ramiarskie)
```css
--ebra-accent: #c9a030    /* główny akcent */
--ebra-accent-dark: #a07828
--ebra-accent-light: #f0d48a
```

### Tailwind custom ramp `accent`
| Stop | Hex | Użycie |
|---|---|---|
| 300 | #e4b84a | hover |
| 400 | #c9a030 | primary |
| 500 | #a07828 | btn-accent |
| 600 | #7c5c20 | dark |

### Klasy utility (index.css)
- `.glass-card` — bg-stone-900/60 backdrop-blur border border-stone-700/50 rounded-xl
- `.btn-accent` — złoty przycisk
- `.btn-ghost` — transparentny
- `.input-field` — dark input z focus accent
- `.label` — uppercase xs tracking

### Fonty
- **Sans:** Inter (Google Fonts CDN)
- **Display:** Playfair Display (nagłówki, brand)

---

## 4. Pliki konfiguracyjne kluczowe

### backend/.env (lokalny dev)
```
DATABASE_URL=sqlite:///./dev.db
FIREBASE_PROJECT_ID=masarski-pro-v2
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase_service_account.json
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

### frontend/.env
```
VITE_FIREBASE_API_KEY=AIzaSyDgwnYBDAK9hw4AwmUGl0kIRT7PbomI9Kc
VITE_FIREBASE_AUTH_DOMAIN=masarski-pro-v2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=masarski-pro-v2
VITE_FIREBASE_STORAGE_BUCKET=masarski-pro-v2.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=704198423857
VITE_FIREBASE_APP_ID=1:704198423857:web:c008416788a064a65cec10
```

---

## 5. Znane błędy i status rozwiązania

| # | Błąd | Status | Rozwiązanie |
|---|---|---|---|
| 1 | `lucide-react` brak ikony `Chrome` | ✅ Naprawiony | Usunięto z importu |
| 2 | Axios interceptor 401 → `window.location` → pętla reload | ✅ Naprawiony | Usunięto redirect z interceptora |
| 3 | Vite wystartował na :5174 zamiast :5173 | ✅ Naprawiony | Dodano :5174 do CORS_ORIGINS w .env |
| 4 | Vite instalacja — brak rolldown@1.0.1 | ✅ Obejście | Downgrade do Vite 5.4.10 |
| 5 | npm TLS UNABLE_TO_VERIFY_LEAF_SIGNATURE | ✅ Obejście | `npm config set strict-ssl false` |
| 6 | `GET /api/auth/me` → 401 Unauthorized | ✅ Naprawiony | Bezwzględna ścieżka service account + `check_revoked=False` |

### Szczegóły naprawy błędu #6

**Dwie przyczyny:** (1) ścieżka `./firebase_service_account.json` była rozwiązywana względem CWD procesu, nie katalogu pliku — przy uruchomieniu z innego folderu plik nie był znajdowany. (2) `verify_id_token` domyślnie wywołuje sieć (`check_revoked=True`) — przy braku dostępu do `googleapis.com` rzucał wyjątek ogólnym komunikatem zamiast konkretnym błędem.

**Rozwiązanie w `dependencies.py`:**
- Bezwzględna ścieżka obliczana przez `os.path.dirname(os.path.abspath(__file__))`
- Fallback: szuka pliku `.json` w katalogu `secret/` jeśli główny plik nie istnieje
- `check_revoked=False` — pomija weryfikację odwołania przez sieć
- Szczegółowe wyjątki: `ExpiredIdTokenError`, `InvalidIdTokenError` z czytelnymi komunikatami

---

## 6. API — przegląd endpointów

| Method | Endpoint | Auth | Opis |
|---|---|---|---|
| GET | `/api/health` | ❌ | Health check |
| GET | `/api/auth/me` | ✅ user | Dane zalogowanego użytkownika + ustawienia warsztatu |
| PUT | `/api/auth/settings` | ✅ user | Zapis danych warsztatu |
| GET | `/api/calculator/ping` | ✅ active | Test auth |
| POST | `/api/calculator/calculate` | ✅ active | Wycena ramy |
| GET | `/api/mouldings` | ✅ active | Lista profili listew |
| POST | `/api/mouldings` | ✅ admin | Dodaj profil |
| GET | `/api/materials` | ✅ active | Materiały użytkownika |
| POST | `/api/materials` | ✅ active | Dodaj materiał |
| DELETE | `/api/materials/{id}` | ✅ active | Usuń materiał |
| GET | `/api/orders` | ✅ active | Zlecenia użytkownika |
| POST | `/api/orders` | ✅ active | Nowe zlecenie |
| DELETE | `/api/orders/{id}` | ✅ active | Usuń zlecenie |
| GET | `/api/admin/users` | ✅ admin | Lista wszystkich użytkowników |
| PATCH | `/api/admin/users/{id}` | ✅ admin | Zmień status użytkownika |

**Poziomy auth:** `user` = zalogowany Firebase, `active` = user + aktywny trial/paid, `admin` = is_superadmin

---

## 7. Serwisy lokalne (uruchamianie)

### Backend (terminal 1)
```powershell
cd D:\DEV\APLIKACJE\ramiarz-master\backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000 --log-level info
```

### Frontend (terminal 2)
```powershell
cd D:\DEV\APLIKACJE\ramiarz-master\frontend
npm run dev
# Domyślnie: localhost:5173 (lub :5174 jeśli zajęty)
```

### Swagger UI (dokumentacja API)
```
http://localhost:8000/docs
```

---

## 8. Plan modułów (kolejność)

| Moduł | Opis | Status |
|---|---|---|
| **M1** | Fundament: React + FastAPI + Firebase Auth | ✅ Ukończony |
| **M2** | Kalkulator — widok UI + endpoint API | ✅ Ukończony (UI + POST /calculate) |
| **M3** | Cenniki listew (globalne) + materiały (per user) | 🔄 Szkielet gotowy, brak formularzy dodawania |
| **M4** | Archiwum zleceń — zapis, lista, druk | 🔄 Szkielet gotowy, brak formularza nowego zlecenia |
| **M5** | Email + SMS — wysyłanie wyceny | 🔲 |
| **M6** | Płatności Stripe + webhook aktywacji | 🔲 |
| **M7** | Panel admina — cenniki globalne, użytkownicy | 🔄 Szkielet gotowy (lista + PATCH statusu) |

---

## 9. TODO / Dług techniczny

- [ ] VAT hardcoded `1.23` w `pricing_service.py` → przenieść do `WorkshopSettings`
- [ ] Migracja Alembic zamiast `create_all` przy starcie
- [ ] `pack_quantity` brakuje w modelu `Moulding` (formularz vs model — rozbieżność ze starego projektu)
- [ ] `Order.details` jako surowy String JSON → rozważyć osobną tabelę `OrderItem`
- [ ] Fonty Inter lokalne — błędy dekodowania (woff2 pliki nieczytelne), na razie Google Fonts CDN
- [ ] Formularze dodawania profili listew i materiałów (M3 — modal/drawer)
- [ ] Formularz nowego zlecenia z kalkulatorem w tle (M4)
- [ ] Kolor akcentu Ramiarz Master — do potwierdzenia przez użytkownika

---

*Dokument aktualizowany automatycznie przez Claude podczas sesji deweloperskiej.*
