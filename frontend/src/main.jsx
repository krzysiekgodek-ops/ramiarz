import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Rejestracja Service Workera jest wstrzykiwana automatycznie przez vite-plugin-pwa
// (registerType: "autoUpdate"). Nie rejestrujemy go tutaj ręcznie.
