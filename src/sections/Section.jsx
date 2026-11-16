/** Card with a heading, an optional counter, and an optional 管理 toggle. */
export default function Section({ title, badge, editing, onToggleEdit, children }) {
  return (
    <section className="section">
      <header className="section-head">
        <h2>
          {title}
          {badge && <span className="badge">{badge}</span>}
        </h2>
        {onToggleEdit && (
          <button className="btn-text" onClick={onToggleEdit} aria-pressed={editing}>
            {editing ? '完成' : '管理'}
          </button>
        )}
      </header>
      {children}
    </section>
  )
}
