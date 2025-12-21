import { ReactNode } from 'react'

const statusStyles: Record<string, string> = {
  running: 'bg-blue-500/15 text-blue-100 border border-blue-500/30',
  completed: 'bg-emerald-500/15 text-emerald-100 border border-emerald-500/30',
  compensated: 'bg-amber-500/15 text-amber-100 border border-amber-500/30',
  failed: 'bg-rose-500/15 text-rose-100 border border-rose-500/30',
  skipped: 'bg-slate-500/15 text-slate-100 border border-slate-500/30',
}

export function StatusPill({ text }: { text: string }) {
  const cls =
    statusStyles[text.toLowerCase()] ??
    'bg-slate-500/10 text-slate-100 border border-slate-500/30'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs rounded-full ${cls}`}>
      {text}
    </span>
  )
}

export function InfoCard({
  label,
  value,
  mono,
}: {
  label: string
  value: ReactNode
  mono?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <div className={`mt-1 text-sm text-slate-100 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}


