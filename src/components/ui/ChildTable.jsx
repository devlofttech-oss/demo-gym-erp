import { Plus, Trash2 } from 'lucide-react'

export default function ChildTable({ 
  columns, // { key, label, type }
  data, 
  onChange,
  onAdd,
  onRemove,
  editing 
}) {
  return (
    <div className="data-table-container" style={{ border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)' }}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => <th key={col.key}>{col.label}</th>)}
            {editing && <th style={{ width: 50 }}></th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (editing ? 1 : 0)} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                No entries found.
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.name || i}>
                {columns.map(col => (
                  <td key={col.key}>
                    {editing ? (
                      <input 
                        className="form-input" 
                        style={{ height: 32, padding: '0 8px' }}
                        type={col.type || 'text'}
                        value={row[col.key] || ''}
                        onChange={(e) => onChange && onChange(i, col.key, e.target.value)}
                      />
                    ) : (
                      row[col.key] || '—'
                    )}
                  </td>
                ))}
                {editing && (
                  <td>
                    <button 
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={(e) => { e.preventDefault(); onRemove && onRemove(i); }}
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {editing && onAdd && (
        <div style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); onAdd(); }}>
            <Plus size={14} /> Add Row
          </button>
        </div>
      )}
    </div>
  )
}
