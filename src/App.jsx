import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import { daysUntil, dueLabel, formatTime } from './dates'
import './App.css'

const ANYONE = 'anyone'

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = still checking

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  if (user === undefined) return <div className="splash">載入中…</div>
  if (!user) return <Login />
  return <Board user={user} />
}

function Login() {
  const [error, setError] = useState('')

  async function login() {
    setError('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return
      setError(`登入失敗（${e.code || e.message}）`)
    }
  }

  return (
    <main className="login">
      <div className="login-mark" aria-hidden="true">🧹</div>
      <h1>家事紀錄板</h1>
      <p>一起記錄、互相提醒還有哪些家事要做</p>
      <button className="btn-primary" onClick={login}>
        使用 Google 登入
      </button>
      {error && <p className="error">{error}</p>}
    </main>
  )
}

function describeError(e) {
  if (e?.code === 'permission-denied') {
    return '這個帳號沒有使用權限。請改用家人的 Google 帳號登入。'
  }
  return `連線發生問題：${e?.message || e}`
}

function Board({ user }) {
  const [members, setMembers] = useState({})
  const [chores, setChores] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('todo')
  const [filter, setFilter] = useState('all')

  const onError = (e) => setError(describeError(e))

  useEffect(() => {
    const fail = (e) => setError(describeError(e))

    // Register this person so the other family member can assign chores to them.
    setDoc(
      doc(db, 'users', user.uid),
      { name: user.displayName || user.email, email: user.email },
      { merge: true },
    ).catch(fail)

    const stopUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const next = {}
        snap.forEach((d) => (next[d.id] = d.data()))
        setMembers(next)
      },
      fail,
    )

    const stopChores = onSnapshot(
      collection(db, 'chores'),
      (snap) => {
        setChores(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })))
        setLoaded(true)
      },
      fail,
    )

    return () => {
      stopUsers()
      stopChores()
    }
  }, [user])

  const partnerId = Object.keys(members).find((id) => id !== user.uid)

  const nameOf = (uid) => {
    if (uid === user.uid) return '我'
    if (uid === ANYONE) return '一起'
    return shortName(members[uid]?.name) || '家人'
  }

  const todo = useMemo(
    () =>
      chores
        .filter((c) => !c.done)
        .sort((a, b) => {
          // Due soonest first; chores without a due date go last, newest first.
          if (a.due && b.due) return a.due.localeCompare(b.due)
          if (a.due) return -1
          if (b.due) return 1
          return millis(b.createdAt) - millis(a.createdAt)
        }),
    [chores],
  )

  const done = useMemo(
    () => chores.filter((c) => c.done).sort((a, b) => millis(b.doneAt) - millis(a.doneAt)),
    [chores],
  )

  const list = (tab === 'todo' ? todo : done).filter((c) => {
    if (filter === 'mine') return c.assignee === user.uid
    if (filter === 'partner') return c.assignee === partnerId
    if (filter === 'together') return c.assignee === ANYONE
    return true
  })

  const filters = [
    ['all', '全部'],
    ['mine', '我的'],
    ...(partnerId ? [['partner', `${nameOf(partnerId)}的`]] : []),
    ['together', '一起'],
  ]

  return (
    <div className="app">
      <header className="topbar">
        <h1>家事紀錄板</h1>
        <button className="btn-text" onClick={() => signOut(auth)} title={user.email}>
          登出
        </button>
      </header>

      {error && (
        <div className="banner" role="alert">
          <span>{error}</span>
          <button className="btn-text" onClick={() => setError('')} aria-label="關閉">
            ✕
          </button>
        </div>
      )}

      <AddChore user={user} members={members} nameOf={nameOf} onError={onError} />

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'todo'} onClick={() => setTab('todo')}>
          待辦 <span className="count">{todo.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'done'} onClick={() => setTab('done')}>
          已完成 <span className="count">{done.length}</span>
        </button>
      </nav>

      <div className="filters">
        {filters.map(([key, label]) => (
          <button key={key} className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      <ul className="list">
        {list.map((chore) => (
          <ChoreItem key={chore.id} chore={chore} user={user} nameOf={nameOf} onError={onError} />
        ))}
      </ul>

      {loaded && list.length === 0 && (
        <p className="empty">{tab === 'todo' ? '沒有待辦家事，休息一下吧 🎉' : '還沒有完成的家事'}</p>
      )}
    </div>
  )
}

function AddChore({ user, members, nameOf, onError }) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(ANYONE)
  const [due, setDue] = useState('')

  function submit(e) {
    e.preventDefault()
    const text = title.trim()
    if (!text) return
    // Don't await: with offline cache the chore shows up immediately and
    // syncs in the background.
    addDoc(collection(db, 'chores'), {
      title: text,
      assignee,
      due: due || null,
      done: false,
      doneBy: null,
      doneAt: null,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    }).catch(onError)
    setTitle('')
    setDue('')
  }

  const memberIds = [user.uid, ...Object.keys(members).filter((id) => id !== user.uid)]

  return (
    <form className="add" onSubmit={submit}>
      <input
        className="add-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="新增家事，例如：倒垃圾"
        enterKeyHint="done"
        maxLength={100}
      />
      <div className="add-row">
        <label className="field">
          <span>誰做</span>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value={ANYONE}>一起</option>
            {memberIds.map((id) => (
              <option key={id} value={id}>
                {nameOf(id)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>期限</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <button className="btn-primary" type="submit" disabled={!title.trim()}>
          新增
        </button>
      </div>
    </form>
  )
}

function ChoreItem({ chore, user, nameOf, onError }) {
  const ref = doc(db, 'chores', chore.id)

  function toggle() {
    const change = chore.done
      ? { done: false, doneBy: null, doneAt: null }
      : { done: true, doneBy: user.uid, doneAt: serverTimestamp() }
    updateDoc(ref, change).catch(onError)
  }

  function remove() {
    if (window.confirm(`刪除「${chore.title}」？`)) deleteDoc(ref).catch(onError)
  }

  const overdue = !chore.done && chore.due && daysUntil(chore.due) < 0
  const dueSoon = !chore.done && chore.due && daysUntil(chore.due) === 0

  return (
    <li className={`item${chore.done ? ' is-done' : ''}`}>
      <button
        className="check"
        role="checkbox"
        aria-checked={chore.done}
        aria-label={chore.done ? `標記「${chore.title}」為未完成` : `完成「${chore.title}」`}
        onClick={toggle}
      >
        {chore.done ? '✓' : ''}
      </button>
      <div className="item-body">
        <div className="item-title">{chore.title}</div>
        <div className="item-meta">
          <span className={`tag tag-${chore.assignee === ANYONE ? 'together' : chore.assignee === user.uid ? 'me' : 'partner'}`}>
            {nameOf(chore.assignee)}
          </span>
          {chore.due && !chore.done && (
            <span className={`due${overdue ? ' overdue' : dueSoon ? ' today' : ''}`}>{dueLabel(chore.due)}</span>
          )}
          {chore.done && (
            <span className="done-by">
              {nameOf(chore.doneBy)}完成・{formatTime(chore.doneAt)}
            </span>
          )}
        </div>
      </div>
      <button className="delete" onClick={remove} aria-label={`刪除「${chore.title}」`}>
        ✕
      </button>
    </li>
  )
}

function millis(timestamp) {
  return timestamp?.toMillis?.() ?? 0
}

/** "王小明" stays as is; "Bruce Wang" becomes "Bruce". */
function shortName(name) {
  if (!name) return ''
  return /\s/.test(name.trim()) ? name.trim().split(/\s+/)[0] : name.trim()
}
