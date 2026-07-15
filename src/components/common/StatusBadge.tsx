import type { DataStatus } from "@/types";
import { STATUS_STYLES } from "@/lib/client/format";

export function StatusBadge({ status }: { status: DataStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`badge ${s.bg} ${s.text}`} title={`Data classification: ${s.label}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
