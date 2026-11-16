// Dates are stored as local 'YYYY-MM-DD' strings so "today" means the
// family's calendar day, not a UTC instant.

export function todayString() {
  return new Date().toLocaleDateString('sv') // sv locale formats as YYYY-MM-DD
}

function toUtcDay(dateString) {
  const [y, m, d] = dateString.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

/** Whole days from today until the due date (negative = overdue). */
export function daysUntil(dateString) {
  return toUtcDay(dateString) - toUtcDay(todayString())
}

export function dueLabel(dateString) {
  const diff = daysUntil(dateString)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff < 0) return `逾期 ${-diff} 天`
  const [, m, d] = dateString.split('-').map(Number)
  return `${m}/${d}`
}

export function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate()
  const sameDay = date.toLocaleDateString('sv') === todayString()
  const time = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  return sameDay ? `今天 ${time}` : `${date.getMonth() + 1}/${date.getDate()} ${time}`
}
