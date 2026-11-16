// 家事板 — iPhone home-screen widget for the Scriptable app (medium size).
// Read-only: shows tonight's unfinished items, trackers at 80%+ and the
// two newest messages. Tap the widget to open the chore board.
//
// Setup: paste this whole file into a new Scriptable script and run it once
// inside Scriptable. It asks for the widget account's password and keeps it
// in the iPhone Keychain (never in this file). Then add a medium Scriptable
// widget to the home screen and pick this script.

const WIDGET_EMAIL = 'widget@whiteboard-app-6db39.firebaseapp.com'
const KEYCHAIN_KEY = 'chore-board-widget-password'

const API_KEY = 'AIzaSyCzgonNEV5CZYbTjtjcJISwYnXthFTlW2k'
const PROJECT = 'whiteboard-app-6db39'
const APP_URL = 'https://bruce10108.github.io/whiteboard_app/'
const DAY_START_HOUR = 4 // must match src/dates.js

const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

const C = {
  bg: Color.dynamic(new Color('#f6f4ef'), new Color('#1c1b19')),
  text: Color.dynamic(new Color('#22201c'), new Color('#ece8e1')),
  muted: Color.dynamic(new Color('#77726a'), new Color('#9d978d')),
  accent: Color.dynamic(new Color('#2f7d5b'), new Color('#4fb386')),
  orange: new Color('#e07b28'),
  red: new Color('#d0412f'),
  track: new Color('#8a857c', 0.25),
}

// ---------- Firebase REST ----------

/** Password from the Keychain; asks for it when run inside the Scriptable app. */
async function getPassword() {
  if (Keychain.contains(KEYCHAIN_KEY)) return Keychain.get(KEYCHAIN_KEY)
  if (config.runsInWidget) throw new Error('請先打開 Scriptable，點一下這個腳本輸入密碼')
  const alert = new Alert()
  alert.title = '家事板小工具'
  alert.message = '請輸入小工具帳號的密碼（只需輸入一次）'
  alert.addSecureTextField('密碼')
  alert.addAction('儲存')
  alert.addCancelAction('取消')
  if ((await alert.present()) === -1) throw new Error('沒有輸入密碼')
  const password = alert.textFieldValue(0).trim()
  if (!password) throw new Error('沒有輸入密碼')
  Keychain.set(KEYCHAIN_KEY, password)
  return password
}

async function signIn() {
  const password = await getPassword()
  const req = new Request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`)
  req.method = 'POST'
  req.headers = { 'Content-Type': 'application/json' }
  req.body = JSON.stringify({ email: WIDGET_EMAIL, password, returnSecureToken: true })
  const res = await req.loadJSON()
  if (res.idToken) return res.idToken
  const code = res.error?.message ?? '未知錯誤'
  if (/DISABLED|OPERATION_NOT_ALLOWED/.test(code)) {
    throw new Error('Firebase 尚未啟用「電子郵件/密碼」登入')
  }
  if (/INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND/.test(code)) {
    Keychain.remove(KEYCHAIN_KEY) // wrong password: ask again next time it runs in the app
    throw new Error('密碼不正確，請打開 Scriptable 點一下腳本重新輸入')
  }
  throw new Error(`登入失敗：${code}`)
}

function decode(v) {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return new Date(v.timestampValue)
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {})
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode)
  return null
}

function decodeFields(fields) {
  const out = {}
  for (const key of Object.keys(fields)) out[key] = decode(fields[key])
  return out
}

const toDoc = (d) => ({ id: d.name.split('/').pop(), ...decodeFields(d.fields ?? {}) })

async function get(token, path) {
  const req = new Request(`${DOCS}/${path}`)
  req.headers = { Authorization: `Bearer ${token}` }
  const res = await req.loadJSON()
  if (req.response.statusCode === 404) return null
  if (res.error) throw new Error(res.error.message)
  return res
}

async function list(token, collection) {
  const res = await get(token, `${collection}?pageSize=300`)
  return (res?.documents ?? []).map(toDoc)
}

async function latestMessages(token, count) {
  const req = new Request(`${DOCS}:runQuery`)
  req.method = 'POST'
  req.headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  req.body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'messages' }],
      orderBy: [{ field: { fieldPath: 'at' }, direction: 'DESCENDING' }],
      limit: count,
    },
  })
  const res = await req.loadJSON()
  if (!Array.isArray(res)) throw new Error(res.error?.message ?? '讀取留言失敗')
  return res.filter((r) => r.document).map((r) => toDoc(r.document))
}

// ---------- Dates (same rules as the app) ----------

const pad = (n) => String(n).padStart(2, '0')

function dayKey(date = new Date()) {
  const d = new Date(date.getTime() - DAY_START_HOUR * 3600000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysBetween(fromKey, toKey) {
  const n = (k) => {
    const [y, m, d] = k.split('-').map(Number)
    return Date.UTC(y, m - 1, d) / 86400000
  }
  return n(toKey) - n(fromKey)
}

// ---------- Data ----------

async function loadBoard() {
  const token = await signIn()
  const today = dayKey()
  const [daily, log, trackers, messages, users] = await Promise.all([
    list(token, 'daily'),
    get(token, `dailyLog/${today}`),
    list(token, 'trackers'),
    latestMessages(token, 2),
    list(token, 'users'),
  ])

  const done = log ? decodeFields(log.fields ?? {}) : {}
  const dailyItems = daily.sort((a, b) => a.order - b.order)
  const pending = dailyItems.filter((item) => !done[item.id]).map((item) => item.title)

  const urgent = trackers
    .map((t) => {
      const days = t.lastDoneAt ? daysBetween(dayKey(t.lastDoneAt), today) : 0
      const left = t.intervalDays - days
      return { title: t.title, ratio: days / t.intervalDays, left }
    })
    .filter((t) => t.ratio >= 0.8)
    .sort((a, b) => b.ratio - a.ratio)

  const names = {}
  for (const u of users) names[u.id] = (u.name ?? '').trim().split(/\s+/)[0] || '家人'

  return {
    total: dailyItems.length,
    pending,
    urgent,
    messages: messages.map((m) => ({ who: names[m.by] ?? '家人', text: m.text })),
  }
}

// ---------- Widget ----------

function bar(ratio, color) {
  const W = 46
  const H = 6
  const ctx = new DrawContext()
  ctx.size = new Size(W, H)
  ctx.opaque = false
  ctx.respectScreenScale = true
  const track = new Path()
  track.addRoundedRect(new Rect(0, 0, W, H), H / 2, H / 2)
  ctx.addPath(track)
  ctx.setFillColor(C.track)
  ctx.fillPath()
  const fill = new Path()
  fill.addRoundedRect(new Rect(0, 0, Math.max(H, W * Math.min(ratio, 1)), H), H / 2, H / 2)
  ctx.addPath(fill)
  ctx.setFillColor(color)
  ctx.fillPath()
  return ctx.getImage()
}

function addText(stack, text, { size = 12, bold = false, color = C.text, lines = 1 } = {}) {
  const t = stack.addText(text)
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size)
  t.textColor = color
  t.lineLimit = lines
  return t
}

function buildWidget(board) {
  const w = new ListWidget()
  w.backgroundColor = C.bg
  w.setPadding(12, 14, 12, 14)
  w.url = APP_URL
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000)

  // Header: title, update time, tonight's progress
  const head = w.addStack()
  head.centerAlignContent()
  addText(head, '🏠 家事板', { size: 14, bold: true })
  head.addSpacer(6)
  addText(head, `${pad(new Date().getHours())}:${pad(new Date().getMinutes())} 更新`, { size: 10, color: C.muted })
  head.addSpacer()
  const doneCount = board.total - board.pending.length
  addText(head, `今晚 ${doneCount}/${board.total}`, {
    size: 12,
    bold: true,
    color: board.pending.length ? C.text : C.accent,
  })

  w.addSpacer(6)

  // Tonight's unfinished items
  if (board.pending.length) {
    addText(w, `☐ ${board.pending.join('　☐ ')}`, { size: 13 })
  } else {
    addText(w, '✓ 今晚都完成了，辛苦了', { size: 13, color: C.accent, bold: true })
  }

  w.addSpacer(6)

  // Trackers at 80% or more (max 3 rows)
  if (board.urgent.length) {
    for (const t of board.urgent.slice(0, 3)) {
      const over = t.ratio >= 1
      const color = over ? C.red : C.orange
      const row = w.addStack()
      row.centerAlignContent()
      const img = row.addImage(bar(t.ratio, color))
      img.imageSize = new Size(46, 6)
      row.addSpacer(8)
      addText(row, t.title, { size: 12 })
      row.addSpacer()
      const label = t.left > 1 ? `還有 ${t.left} 天` : t.left === 1 ? '明天到期' : t.left === 0 ? '今天到期' : `超過 ${-t.left} 天`
      addText(row, label, { size: 11, bold: true, color })
      w.addSpacer(3)
    }
    if (board.urgent.length > 3) addText(w, `還有 ${board.urgent.length - 3} 項快到期`, { size: 10, color: C.muted })
  } else {
    addText(w, '定期追蹤都還早 👍', { size: 12, color: C.muted })
  }

  w.addSpacer()

  // Two newest messages
  for (const m of board.messages) {
    addText(w, `💬 ${m.who}：${m.text}`, { size: 11, color: C.muted })
  }

  return w
}

function errorWidget(message) {
  const w = new ListWidget()
  w.backgroundColor = C.bg
  w.url = APP_URL
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000)
  addText(w, '🏠 家事板', { size: 14, bold: true })
  w.addSpacer(6)
  addText(w, `暫時無法更新：${message}`, { size: 12, color: C.red, lines: 3 })
  return w
}

let widget
try {
  widget = buildWidget(await loadBoard())
} catch (e) {
  widget = errorWidget(e.message ?? String(e))
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()
