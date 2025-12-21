import { useState } from 'react'
import { Field } from './Field'

export function SignalForm({
  onSend,
  disabled,
}: {
  onSend: (signal: string, payload: Record<string, unknown>) => void
  disabled?: boolean
}) {
  const [signal, setSignal] = useState('resume')
  const [payload, setPayload] = useState('{ }')

  const handleSend = () => {
    let parsed: Record<string, unknown> = {}
    try {
      parsed = payload.trim() ? JSON.parse(payload) : {}
    } catch {
      parsed = {}
    }
    onSend(signal, parsed)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Signal" value={signal} onChange={setSignal} />
        <Field label="Payload (JSON)" value={payload} onChange={setPayload} />
      </div>
      <button
        onClick={handleSend}
        disabled={disabled}
        className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-medium disabled:opacity-60"
      >
        Send Signal
      </button>
    </div>
  )
}


