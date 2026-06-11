import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string | number;
  icon?: ReactNode;
};

export function MetricCard({ label, value, icon }: Props) {
  return (
    <div className="lab-surface rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        {icon ? <div className="text-teal-700">{icon}</div> : null}
      </div>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}
