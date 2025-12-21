type InputProps = {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'number'
  helper?: string
}

export function Field({ label, value, onChange, type = 'text', helper }: InputProps) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-200">
      <span className="text-slate-300">{label}</span>
      <input
        value={value}
        type={type}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none"
      />
      {helper && <span className="text-xs text-slate-400">{helper}</span>}
    </label>
  )
}


