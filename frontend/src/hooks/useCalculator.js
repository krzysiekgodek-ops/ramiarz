import { useState, useCallback } from "react";
import api from "../services/api";

const INITIAL_PARAMS = {
  width_cm:              50,
  height_cm:             40,
  moulding_id:           null,
  liner_id:              null,
  use_frame_price_main:  false,
  use_frame_price_liner: false,
  front_id:              null,
  backing_id:            null,
  foam_id:               null,
  pp_id:                 null,
  frame_price_id:        null,
  extra_fee:             0,
  discount_pct:          0,
};

/**
 * Hook zarządzający stanem kalkulatora wyceny ram.
 * Wywołuje POST /api/calculator/calculate z parametrami.
 */
export function useCalculator() {
  const [params, setParams]   = useState(INITIAL_PARAMS);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const updateParam = useCallback((key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    // Wyczyść poprzedni wynik gdy zmienią się parametry
    setResult(null);
  }, []);

  const calculate = useCallback(async () => {
    if (!params.moulding_id) {
      setError("Wybierz profil listwy przed obliczeniem.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/calculator/calculate", params);
      setResult(data);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Błąd podczas obliczania wyceny.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [params]);

  const reset = useCallback(() => {
    setParams(INITIAL_PARAMS);
    setResult(null);
    setError(null);
  }, []);

  return {
    params,
    updateParam,
    setParams,
    result,
    loading,
    error,
    calculate,
    reset,
  };
}
