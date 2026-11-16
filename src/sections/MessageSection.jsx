import { useState } from 'react'
import { Timestamp, addDoc, collection, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useCollection } from '../hooks'
import { when } from '../dates'
import Section from './Section'

const PAGE = 5

export default function MessageSection({ ctx }) {
  const { user, today, nameOf, onError } = ctx
  const messages = useCollection('messages', onError)
  const [text, setText] = useState('')
  const [shown, setShown] = useState(PAGE)

  const sorted = [...(messages ?? [])].sort((a, b) => b.at.toMillis() - a.at.toMillis())

  function send(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    addDoc(collection(db, 'messages'), { text: body, by: user.uid, at: Timestamp.now() }).catch(onError)
    setText('')
  }

  function remove(m) {
    if (window.confirm('刪除這則留言？')) deleteDoc(doc(db, 'messages', m.id)).catch(onError)
  }

  return (
    <Section title="留言板">
      <form className="inline-add" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="寫點什麼，提醒或打氣都好"
          maxLength={300}
          enterKeyHint="send"
        />
        <button className="btn-primary" disabled={!text.trim()}>
          送出
        </button>
      </form>
      {messages && sorted.length === 0 && <p className="empty">還沒有留言</p>}
      <ul className="messages">
        {sorted.slice(0, shown).map((m) => (
          <li key={m.id} className={`message${m.by === user.uid ? ' mine' : ''}`}>
            <p className="message-text">{m.text}</p>
            <div className="message-meta">
              <span>
                {nameOf(m.by)}・{when(m.at, today)}
              </span>
              {m.by === user.uid && (
                <button className="btn-link" onClick={() => remove(m)}>
                  刪除
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {sorted.length > shown && (
        <button className="btn-more" onClick={() => setShown(shown + PAGE)}>
          顯示更早的留言
        </button>
      )}
    </Section>
  )
}
