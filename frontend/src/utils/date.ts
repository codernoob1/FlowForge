export const fmt = (date: string | undefined) =>
  date ? new Date(date).toLocaleString() : '—'


