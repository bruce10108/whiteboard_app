import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import { useCollection, useToday } from './hooks'
import { seedDefaults } from './seed'
import { headerDate } from './dates'
import DailySection from './sections/DailySection'
import TrackerSection from './sections/TrackerSection'
import TodoSection from './sections/TodoSection'
import MessageSection from './sections/MessageSection'
import Toast from './Toast'
import './App.css'

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
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        return signInWithRedirect(auth, googleProvider)
      }
      setError(`登入失敗（${e.code || e.message}）`)
    }
  }

  return (
    <main className="login">
      <img className="login-icon" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
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
  if (e?.code === 'permission-denied') return '這個帳號沒有使用權限，請改用家人的 Google 帳號登入。'
  if (e?.code === 'unavailable') return '目前離線，恢復連線後會自動同步。'
  return `發生問題：${e?.message || e}`
}

/** "王小明" stays as is; "Bruce Wang" becomes "Bruce". */
function shortName(name = '') {
  const trimmed = name.trim()
  return trimmed.split(/\s+/)[0] || trimmed
}

function Board({ user }) {
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const onError = useCallback((e) => setError(describeError(e)), [])
  const notify = useCallback((text, undo) => setToast({ text, undo, id: Date.now() }), [])
  const closeToast = useCallback(() => setToast(null), [])
  const today = useToday()
  const users = useCollection('users', onError)

  useEffect(() => {
    // Register this person so their name shows up on the other phone.
    setDoc(doc(db, 'users', user.uid), { name: user.displayName || user.email, email: user.email }, { merge: true }).catch(
      onError,
    )
    seedDefaults().catch((e) => e?.code !== 'unavailable' && onError(e))
  }, [user, onError])

  const nameOf = useCallback(
    (uid) => {
      if (uid === user.uid) return '我'
      const member = users?.find((u) => u.id === uid)
      return member ? shortName(member.name) : '家人'
    },
    [user, users],
  )

  const ctx = { user, today, nameOf, onError, notify }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>家事紀錄板</h1>
          <p className="today">{headerDate(today)}</p>
        </div>
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

      <DailySection ctx={ctx} />
      <TrackerSection ctx={ctx} />
      <TodoSection ctx={ctx} />
      <MessageSection ctx={ctx} />

      <Toast toast={toast} onClose={closeToast} />
    </div>
  )
}
