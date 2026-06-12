import { useSubscription } from "../hooks/useSubscription";
import { Lock } from "lucide-react";

export default function SubscriptionGate({ children }) {
  const { isPro } = useSubscription();
  if (isPro) return children;

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center rounded-lg
                      bg-stone-900/5 dark:bg-stone-900/30 backdrop-blur-[1px]">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                        bg-amber-100 dark:bg-amber-900/40
                        border border-amber-300 dark:border-amber-700/50
                        text-amber-700 dark:text-amber-400 text-xs font-medium">
          <Lock size={11} />
          Dostępne w planie PRO
        </div>
      </div>
    </div>
  );
}
