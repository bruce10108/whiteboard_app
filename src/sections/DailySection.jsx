import { useState } from 'react'
import { Timestamp, addDoc, collection, deleteDoc, deleteField, doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useCollection, useDocument } from '../hooks'
import { clock } from '../dates'
import Section from './Section'

/** Nightly checklist; ticks are stored per household day in dailyLog/{YYYY-MM-DD}. */
export default function DailySection({ ctx }) {
  const { user, today, nameOf, onError } = ctx
  const items = useCollection('daily', onError)
  const log = useDocument(`dailyLog/${today}`, onError)
  const [editing, setEditing] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const sorted = [...(items ?? [])].sort((a, b) => a.order - b.order)
  const doneCount = log ? sorted.filter((item) => log[item.id]).length : 0
  const allDone = sorted.length > 0 && doneCount === sorted.length

  function toggle(item) {
    const entry = log?.[item.id]
    setDoc(
      doc(db, 'dailyLog', today),
      { [item.id]: entry ? deleteField() : { by: user.uid, at: Timestamp.now() } },
      { merge: true },
    ).catch(onError)
  }

  function add(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    const order = Math.max(-1, ...sorted.map((i) => i.order)) + 1
    addDoc(collection(db, 'daily'), { title, order }).catch(onError)
    setNewTitle('')
  }

  function remove(item) {
    if (window.confirm(`從每日必做刪除「${item.title}」？`)) deleteDoc(doc(db, 'daily', item.id)).catch(onError)
  }

  return (
    <Section
      title="今晚必做"
      badge={items && `${doneCount}/${sorted.length}`}
      editing={editing}
      onToggleEdit={() => setEditing(!editing)}
    >
      {allDone && !editing && <p className="cheer">今晚都完成了，辛苦了 💪</p>}
      <ul className="rows">
        {sorted.map((item) => {
          const entry = log?.[item.id]
          return (
            <li key={item.id} className={`row${entry ? ' is-done' : ''}`}>
              <button
                className="row-main"
                role="checkbox"
                aria-checked={!!entry}
                onClick={() => toggle(item)}
                disabled={editing}
              >
                <span className="check" aria-hidden="true">
                  {entry ? '✓' : ''}
                </span>
                <span className="row-title">{item.title}</span>
                {entry && (
                  <span className="row-side">
                    {nameOf(entry.by)}・{clock(entry.at)}
                  </span>
                )}
              </button>
              {editing && (
                <button className="delete" onClick={() => remove(item)} aria-label={`刪除「${item.title}」`}>
                  ✕
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {editing && (
        <form className="inline-add" onSubmit={add}>
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="新增每日項目" maxLength={40} />
          <button className="btn-primary" disabled={!newTitle.trim()}>
            新增
          </button>
        </form>
      )}
    </Section>
  )
}
