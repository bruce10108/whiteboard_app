// The household "day" starts at 04:00, so chores done after midnight
// (after the kids are asleep) still count for the evening before.
const DAY_START_HOUR = 4

const pad = (n) => String(n).padStart(2, '0')

/** Household day as 'YYYY-MM-DD' (local time, shifted by DAY_START_HOUR). */
export function dayKey(date = new Date()) {
  const d = new Date(date.getTime() - DAY_START_HOUR * 3600000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toDayNumber(key) {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

export function daysBetween(fromKey, toKey) {
  return toDayNumber(toKey) - toDayNumber(fromKey)
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function headerDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${m} 月 ${d} 日・週${weekday}`
}

export function clock(timestamp) {
  const d = timestamp.toDate()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "今天 21:30" / "昨天 08:12" / "11/3 19:05" */
export function when(timestamp, todayKey) {
  const days = daysBetween(dayKey(timestamp.toDate()), todayKey)
  if (days === 0) return `今天 ${clock(timestamp)}`
  if (days === 1) return `昨天 ${clock(timestamp)}`
  const d = timestamp.toDate()
  return `${d.getMonth() + 1}/${d.getDate()} ${clock(timestamp)}`
}

/** Days since a timestamp, counted in household days. */
export function daysSince(timestamp, todayKey) {
  return daysBetween(dayKey(timestamp.toDate()), todayKey)
}
