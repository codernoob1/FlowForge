import { SignalForm } from './SignalForm'
import { StatusPill, InfoCard } from './StatusPill'
import { fmt } from '../utils/date'
import type { WorkflowDetail } from '../types'

export function WorkflowDetailPanel({
  detail,
  selectedId,
  onRefresh,
  loading,
  onSendSignal,
}: {
  detail: WorkflowDetail | null
  selectedId: string | null
  onRefresh: () => void
  loading: boolean
  onSendSignal: (signal: string, payload: Record<string, unknown>) => void
}) {
  return (
    <section className="glass rounded-2xl p-6 border border-slate-700/60">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Workflow Detail</h2>
          <p className="text-sm text-slate-300">
            Select a workflow from the table to inspect steps & compensations.
          </p>
        </div>
        {selectedId && (
          <button
            onClick={onRefresh}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            {loading ? 'Refreshing…' : 'Refresh detail'}
          </button>
        )}
      </div>

      {!selectedId && <p className="mt-4 text-slate-400">No workflow selected.</p>}
      {selectedId && loading && <p className="mt-4 text-slate-400">Loading detail…</p>}

      {detail && !loading && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <InfoCard label="Workflow ID" value={detail.workflow.id} mono />
            <InfoCard label="Status" value={<StatusPill text={detail.workflow.status} />} />
            <InfoCard label="Current Step" value={detail.workflow.currentStep ?? '—'} />
            <InfoCard label="Updated" value={fmt(detail.workflow.updatedAt)} />
          </div>

          {detail.workflow.error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              Error: {detail.workflow.error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <StepsList steps={detail.steps} />
            <div className="space-y-4">
              <CompensationsList compensations={detail.compensations} />
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2">
                <div className="text-sm text-slate-200 font-medium">Send Signal</div>
                <p className="text-xs text-slate-400">
                  For waiting workflows (not currently used, but showcases resume capability).
                </p>
                <SignalForm onSend={onSendSignal} disabled={!selectedId || loading} />
              </div>
              <div>
                <div className="text-sm text-slate-200 font-medium mb-2">Workflow Context</div>
                <pre className="text-xs bg-slate-950/70 border border-slate-800 rounded p-3 overflow-auto text-slate-200">
                  {JSON.stringify(detail.workflow.context, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function StepsList({ steps }: { steps: WorkflowDetail['steps'] }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-100">Steps</h3>
      </div>
      <div className="space-y-3">
        {steps.map(step => (
          <div
            key={step.stepName}
            className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="text-slate-100 font-medium">{step.stepName}</div>
              <StatusPill text={step.status} />
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Started: {fmt(step.startedAt)} • Completed: {fmt(step.completedAt)}
            </div>
            {step.error && (
              <div className="mt-2 text-xs text-rose-200">Error: {step.error.message}</div>
            )}
            {step.output && (
              <pre className="mt-2 text-xs bg-slate-950/70 border border-slate-800 rounded p-2 overflow-auto text-slate-200">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {steps.length === 0 && <p className="text-sm text-slate-400">No steps recorded.</p>}
      </div>
    </div>
  )
}

function CompensationsList({
  compensations,
}: {
  compensations: WorkflowDetail['compensations']
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">Compensations</h3>
      </div>
      <div className="space-y-3">
        {compensations.map(c => (
          <div
            key={c.stepName}
            className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-100 font-medium">{c.stepName}</div>
                <div className="text-xs text-slate-400">Compensation: {c.compensationStep}</div>
              </div>
              <StatusPill text={c.executed ? c.result ?? 'executed' : 'pending'} />
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Executed: {c.executed ? fmt(c.executedAt) : 'Not executed'}
            </div>
          </div>
        ))}
        {compensations.length === 0 && (
          <p className="text-sm text-slate-400">No compensations registered.</p>
        )}
      </div>
    </div>
  )
}


