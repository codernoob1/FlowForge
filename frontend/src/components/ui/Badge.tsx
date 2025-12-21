import type { WorkflowStatus } from '../../types'

const colors: Record<string, string> = {
  running: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  completed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  failed: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  cancelled: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  compensating: 'text-amber-200 bg-amber-500/10 border-amber-500/30',
  pending: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
}

export function Badge({ status }: { status: WorkflowStatus | string }) {
  const key = String(status).toLowerCase()
  const cls =
    colors[key] ?? 'text-slate-200 bg-slate-500/10 border-slate-500/30'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  )
}

