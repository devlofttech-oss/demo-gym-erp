import { useState } from 'react'

export default function Tabs({ tabs, defaultTab, onChange }) {
  const [active, setActive] = useState(defaultTab || (tabs.length > 0 ? tabs[0].id : null))

  const handleTabClick = (id) => {
    setActive(id)
    if (onChange) onChange(id)
  }

  return (
    <div className="tabs-container" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="tabs-nav" style={{ 
        display: 'flex', 
        gap: 'var(--space-4)', 
        borderBottom: '1px solid var(--surface-border)',
        marginBottom: 'var(--space-4)'
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabClick(t.id)}
            style={{
              padding: 'var(--space-3) var(--space-2)',
              background: 'transparent',
              border: 'none',
              borderBottom: active === t.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: active === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: active === t.id ? 600 : 500,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tabs-content">
        {tabs.find(t => t.id === active)?.content}
      </div>
    </div>
  )
}
