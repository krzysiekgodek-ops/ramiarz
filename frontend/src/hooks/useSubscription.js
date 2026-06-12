import { useAuth } from "./useAuth";

export function useSubscription() {
  const { dbUser } = useAuth();

  if (!dbUser) return { isPro: false, isOnTrial: false, trialDaysLeft: 0, planLabel: null };

  const now = new Date();

  // PRO: is_paid=true i (brak daty końca LUB data końca w przyszłości)
  const subExp = dbUser.subscription_expires ? new Date(dbUser.subscription_expires) : null;
  const isPro = !!dbUser.is_paid && (!subExp || subExp > now);

  // Trial: nie PRO i trial_expires w przyszłości
  const trialExp = dbUser.trial_expires ? new Date(dbUser.trial_expires) : null;
  const isOnTrial = !isPro && !!trialExp && trialExp > now;

  // Dni pozostałe w trialu
  const trialDaysLeft = isOnTrial
    ? Math.max(0, Math.ceil((trialExp - now) / (1000 * 60 * 60 * 24)))
    : 0;

  // Etykieta planu
  const planLabel =
    dbUser.subscription_plan === "monthly" ? "Miesięczny" :
    dbUser.subscription_plan === "yearly"  ? "Roczny" :
    isOnTrial ? "Trial" : null;

  return { isPro, isOnTrial, trialDaysLeft, planLabel, dbUser };
}
