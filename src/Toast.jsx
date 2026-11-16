import { useEffect } from 'react'

/** Short confirmation at the bottom of the screen, with an optional undo. */
export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.text}</span>
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo()
            onClose()
          }}
        >
          復原
        </button>
      )}
    </div>
  )
}
