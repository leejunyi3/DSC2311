import { Info } from "lucide-react";

/** Reusable disclaimer banner (§3). */
export function Disclaimer({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-400">
      <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
