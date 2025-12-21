import type { WorkflowSummary } from '../types'
import { StatusPill } from './StatusPill'
import { fmt } from '../utils/date'

export function WorkflowsTable({
  workflows,
  onSelect,
  onRefresh,
  loading,
}: {
  workflows: WorkflowSummary[]
  onSelect: (id: string) => void
  onRefresh: () => void
  loading: boolean
}) {
  return (
    <section className="glass rounded-2xl p-6 border border-slate-700/60">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Workflows</h2>
          <p className="text-sm text-slate-300">Newest first</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-700/60">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-slate-200">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Current Step</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {workflows.map(wf => (
              <tr key={wf.id} className="hover:bg-slate-900/40 transition">
                <td className="px-4 py-3 font-mono text-xs text-slate-200">{wf.id}</td>
                <td className="px-4 py-3">
                  <StatusPill text={wf.status} />
                </td>
                <td className="px-4 py-3 text-slate-200">{wf.currentStep ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{fmt(wf.updatedAt)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onSelect(wf.id)}
                    className="text-sky-300 hover:text-sky-200 text-sm"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {workflows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-center text-slate-400">
                  {loading ? 'Loading…' : 'No workflows yet. Start one above.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

