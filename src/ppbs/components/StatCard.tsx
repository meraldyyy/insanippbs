import type { LucideIcon } from 'lucide-react';

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  tone: string;
  trend: string;
};

export function StatCard({ icon: Icon, label, value, detail, tone, trend }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={20} /></div>
      <div className="stat-copy">
        <span>{label}</span><strong>{value}</strong><small>{detail}</small>
      </div>
      <div className={`stat-trend ${tone}`}>{trend}</div>
    </div>
  );
}
