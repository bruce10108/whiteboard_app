import { useState } from 'react'
import { Timestamp, addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useCollection } from '../hooks'
import { dayKey, daysBetween } from '../dates'
import Section from './Section'

/** How full the bar is and how urgent, based on whole days since last done. */
function status(tracker, today) {
  const lastKey = tracker.lastDoneAt ? dayKey(tracker.lastDoneAt.toDate()) : today
  const days = daysBetween(lastKey, today)
  const left = tracker.intervalDays - days
  const ratio = Math.min(days / tracker.intervalDays, 1)
  const level = ratio >= 1 ? 'over' : ratio >= 0.75 ? 'soon' : ratio >= 0.5 ? 'mid' : 'ok'
  const label = left > 1 ? `還有 ${left} 天` : left === 1 ? '明天到期' : left === 0 ? '今天到期' : `超過 ${-left} 天`
  return { lastKey, days, ratio, level, label, urgency: days / tracker.intervalDays }
}

function shortDate(key) {
  const [, m, d] = key.split('-').map(Number)
  return `${m}/${d}`
}

export default function TrackerSection({ ctx }) {
  const { user, today, nameOf, onError, notify } = ctx
  const trackers = useCollection('trackers', onError)
  const [editing, setEditing] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDays, setNewDays] = useState('7')

  // Most overdue first.
  const rows = (trackers ?? [])
    .map((t) => ({ ...t, s: status(t, today) }))
    .sort((a, b) => b.s.urgency - a.s.urgency || a.title.localeCompare(b.title, 'zh-Hant'))

  const overdue = rows.filter((r) => r.s.level === 'over').length

  function undoable(t, change, message) {
    const ref = doc(db, 'trackers', t.id)
    const previous = { lastDoneAt: t.lastDoneAt ?? null, lastDoneBy: t.lastDoneBy ?? null }
    updateDoc(ref, change).catch(onError)
    notify(message, () => updateDoc(ref, previous).catch(onError))
  }

  function markDone(t) {
    undoable(t, { lastDoneAt: Timestamp.now(), lastDoneBy: user.uid }, `「${t.title}」已記錄`)
  }

  function changeDate(t, value) {
    if (!value || value > today || value === t.s.lastKey) return
    const [y, m, d] = value.split('-').map(Number)
    // Noon keeps the timestamp safely inside that household day.
    undoable(t, { lastDoneAt: Timestamp.fromDate(new Date(y, m - 1, d, 12)) }, `「${t.title}」上次完成改為 ${m}/${d}`)
  }

  function saveTitle(t, input) {
    const title = input.value.trim()
    if (title && title !== t.title) updateDoc(doc(db, 'trackers', t.id), { title }).catch(onError)
    else input.value = t.title
  }

  function saveInterval(t, input) {
    const n = Number.parseInt(input.value, 10)
    if (n >= 1 && n <= 365) {
      if (n !== t.intervalDays) updateDoc(doc(db, 'trackers', t.id), { intervalDays: n }).catch(onError)
    } else {
      input.value = t.intervalDays
    }
  }

  function remove(t) {
    if (window.confirm(`刪除追蹤項目「${t.title}」？`)) deleteDoc(doc(db, 'trackers', t.id)).catch(onError)
  }

  function add(e) {
    e.preventDefault()
    const title = newTitle.trim()
    const intervalDays = Number.parseInt(newDays, 10)
    if (!title || !(intervalDays >= 1 && intervalDays <= 365)) return
    const now = Timestamp.now()
    addDoc(collection(db, 'trackers'), { title, intervalDays, lastDoneAt: now, lastDoneBy: null, createdAt: now }).catch(
      onError,
    )
    setNewTitle('')
  }

  return (
    <Section
      title="定期追蹤"
      badge={overdue > 0 ? `${overdue} 項到期` : null}
      editing={editing}
      onToggleEdit={() => setEditing(!editing)}
    >
      <ul className="rows">
        {rows.map((t) =>
          editing ? (
            <li key={t.id} className="tracker tracker-editing">
              <input
                key={t.title}
                className="title-edit"
                defaultValue={t.title}
                maxLength={40}
                onBlur={(e) => saveTitle(t, e.target)}
                aria-label="項目名稱"
              />
              <label className="days-input">
                每
                <input
                  key={t.intervalDays}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="365"
                  defaultValue={t.intervalDays}
                  onBlur={(e) => saveInterval(t, e.target)}
                  aria-label={`「${t.title}」週期天數`}
                />
                天
              </label>
              <button className="delete" onClick={() => remove(t)} aria-label={`刪除「${t.title}」`}>
                ✕
              </button>
            </li>
          ) : (
            <li key={t.id} className={`tracker level-${t.s.level}`}>
              <div className="tracker-top">
                <div className="tracker-text">
                  <span className="row-title">
                    {t.title}
                    <span className="interval">（{t.intervalDays} 天）</span>
                  </span>
                  <span className="tracker-meta">
                    <label className="date-pick">
                      上次 {shortDate(t.s.lastKey)}
                      <input
                        type="date"
                        value={t.s.lastKey}
                        max={today}
                        onClick={(e) => e.target.showPicker?.()}
                        onChange={(e) => changeDate(t, e.target.value)}
                        aria-label={`修改「${t.title}」上次完成日期`}
                      />
                    </label>
                    {t.lastDoneBy && `・${nameOf(t.lastDoneBy)}`}
                  </span>
                </div>
                <span className="tracker-label">{t.s.label}</span>
                <button className="btn-done" onClick={() => markDone(t)}>
                  做好了
                </button>
              </div>
              <div
                className="bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(t.s.ratio * 100)}
                aria-label={`${t.title}：${t.s.label}`}
              >
                <div className="bar-fill" style={{ width: `${Math.max(t.s.ratio * 100, 3)}%` }} />
              </div>
            </li>
          ),
        )}
      </ul>
      {editing && (
        <form className="inline-add" onSubmit={add}>
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="新增追蹤項目" maxLength={40} />
          <label className="days-input">
            每
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="365"
              value={newDays}
              onChange={(e) => setNewDays(e.target.value)}
              aria-label="週期天數"
            />
            天
          </label>
          <button className="btn-primary" disabled={!newTitle.trim()}>
            新增
          </button>
        </form>
      )}
    </Section>
  )
}
