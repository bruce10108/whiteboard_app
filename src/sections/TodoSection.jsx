import { useState } from 'react'
import { Timestamp, addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useCollection } from '../hooks'
import { daysSince } from '../dates'
import Section from './Section'

/** Free-form "do it when you have time" list; oldest first so nothing gets forgotten. */
export default function TodoSection({ ctx }) {
  const { user, today, nameOf, onError, notify } = ctx
  const todos = useCollection('todos', onError)
  const [editing, setEditing] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const open = (todos ?? []).filter((t) => !t.done).sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())

  function complete(t) {
    const ref = doc(db, 'todos', t.id)
    updateDoc(ref, { done: true, doneBy: user.uid, doneAt: Timestamp.now() }).catch(onError)
    notify(`「${t.title}」完成了`, () => updateDoc(ref, { done: false, doneBy: null, doneAt: null }).catch(onError))
  }

  function remove(t) {
    if (window.confirm(`刪除「${t.title}」？`)) deleteDoc(doc(db, 'todos', t.id)).catch(onError)
  }

  function add(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    addDoc(collection(db, 'todos'), {
      title,
      createdBy: user.uid,
      createdAt: Timestamp.now(),
      done: false,
      doneBy: null,
      doneAt: null,
    }).catch(onError)
    setNewTitle('')
  }

  return (
    <Section
      title="有空再做"
      badge={open.length ? `${open.length}` : null}
      editing={editing}
      onToggleEdit={() => setEditing(!editing)}
    >
      {todos && open.length === 0 && <p className="empty">目前沒有待清的事項</p>}
      <ul className="rows">
        {open.map((t) => {
          const age = daysSince(t.createdAt, today)
          return (
            <li key={t.id} className="row">
              <button className="row-main" role="checkbox" aria-checked={false} onClick={() => complete(t)} disabled={editing}>
                <span className="check" aria-hidden="true" />
                <span className="row-title">{t.title}</span>
                <span className={`row-side${age >= 14 ? ' stale' : ''}`}>
                  {nameOf(t.createdBy)}・{age === 0 ? '今天' : `放了 ${age} 天`}
                </span>
              </button>
              {editing && (
                <button className="delete" onClick={() => remove(t)} aria-label={`刪除「${t.title}」`}>
                  ✕
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <form className="inline-add" onSubmit={add}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="例如：整理儲藏室"
          maxLength={60}
          enterKeyHint="done"
        />
        <button className="btn-primary" disabled={!newTitle.trim()}>
          新增
        </button>
      </form>
    </Section>
  )
}
