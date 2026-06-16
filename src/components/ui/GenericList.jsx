import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFrappeGetDocList, useFrappeDeleteDoc } from 'frappe-react-sdk'
import { Search, Plus, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import Loader from './Loader'
import EmptyState from './EmptyState'
import { formatDate, getStatusColor, truncateText } from '../../utils/formatters'
import { PAGE_SIZE } from '../../utils/constants'

export default function GenericList({
  doctype,
  title,
  subtitle,
  icon: Icon,
  fields = ['name', 'creation', 'modified'],
  searchField = 'name',
  statusField = 'status',
  statusOptions = [],
  columns = [], // { label, key, format: (val, doc) => ReactNode }
  basePath,
  onCreate,
}) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)

  const filters = []
  if (statusFilter && statusField) filters.push([statusField, '=', statusFilter])
  if (searchTerm && searchField) filters.push([searchField, 'like', `%${searchTerm}%`])

  const { data: docs, isLoading, mutate } = useFrappeGetDocList(doctype, {
    fields: Array.from(new Set(['name', 'creation', ...fields])),
    filters: filters.length > 0 ? filters : undefined,
    orderBy: { field: 'creation', order: 'desc' },
    limit: PAGE_SIZE,
    start: page * PAGE_SIZE,
  })

  const { deleteDoc } = useFrappeDeleteDoc()

  const handleDelete = async (e, name) => {
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete this ${doctype}?`)) return
    try {
      await deleteDoc(doctype, name)
      toast.success(`${doctype} deleted`)
      mutate()
    } catch (err) {
      toast.error(err?.message || `Failed to delete ${doctype}`)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {onCreate && (
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={onCreate}>
              <Plus size={18} /> New {title.slice(0, -1)}
            </button>
          </div>
        )}
      </div>

      <div className="filter-bar">
        {searchField && (
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
              style={{ paddingLeft: 36, minWidth: 220 }}
            />
          </div>
        )}
        {statusField && statusOptions.length > 0 && (
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          >
            <option value="">All Statuses</option>
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      <div className="card">
        {isLoading ? (
          <Loader />
        ) : !docs || docs.length === 0 ? (
          <EmptyState
            icon={Icon}
            title={`No ${title.toLowerCase()} found`}
            description={`Create your first ${title.slice(0, -1).toLowerCase()} or adjust your filters`}
            action={
              onCreate && (
                <button className="btn btn-primary" onClick={onCreate}>
                  <Plus size={18} /> Create {title.slice(0, -1)}
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    {columns.map(c => <th key={c.key || c.label}>{c.label}</th>)}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr
                      key={doc.name}
                      onClick={() => basePath && navigate(`${basePath}/${doc.name}`)}
                      style={{ cursor: basePath ? 'pointer' : 'default' }}
                    >
                      {columns.map(c => (
                        <td key={c.key || c.label}>
                          {c.format ? c.format(doc[c.key], doc) : doc[c.key] || '—'}
                        </td>
                      ))}
                      <td>
                        <div className="flex gap-1">
                          {basePath && (
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={(e) => { e.stopPropagation(); navigate(`${basePath}/${doc.name}`); }}
                              title="View"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={(e) => handleDelete(e, doc.name)}
                            title="Delete"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span className="pagination-info">
                Showing {page * PAGE_SIZE + 1}—{page * PAGE_SIZE + docs.length} results
              </span>
              <div className="pagination-controls">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={docs.length < PAGE_SIZE}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
