import type { Toast } from '../types'

export function ToastBanner({ toast }: { toast: Toast }) {
  if (!toast) return null
  const isSuccess = toast.type === 'success'
  return (
    <div
      className={`rounded-lg px-4 py-3 text-sm border ${
        isSuccess
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-100'
          : 'bg-rose-500/15 border-rose-500/40 text-rose-100'
      }`}
    >
      {toast.msg}
    </div>
  )
}

