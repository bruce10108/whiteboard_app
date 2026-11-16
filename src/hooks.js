import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { dayKey } from './dates'

/** Live list of a collection's documents; null while loading. */
export function useCollection(name, onError) {
  const [items, setItems] = useState(null)
  useEffect(
    () =>
      onSnapshot(
        collection(db, name),
        (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        onError,
      ),
    [name, onError],
  )
  return items
}

/** Live document data ({} if it doesn't exist yet); null while loading. */
export function useDocument(path, onError) {
  const [state, setState] = useState({ path: null, data: null })
  useEffect(
    () =>
      onSnapshot(
        doc(db, path),
        (snap) => setState({ path, data: snap.data() ?? {} }),
        onError,
      ),
    [path, onError],
  )
  // Ignore data left over from a previous path (e.g. right after the day rolls over).
  return state.path === path ? state.data : null
}

/** Current household day key; updates when the day rolls over. */
export function useToday() {
  const [key, setKey] = useState(dayKey)
  useEffect(() => {
    const refresh = () => setKey(dayKey())
    const timer = setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return key
}
