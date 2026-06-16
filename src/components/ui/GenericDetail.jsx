import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFrappeGetDoc, useFrappeUpdateDoc } from 'frappe-react-sdk'
import { ArrowLeft, Save, Calendar, User } from 'lucide-react'
import toast from 'react-hot-toast'
import Loader from './Loader'
import { formatDate, formatDateTime, getStatusColor } from '../../utils/formatters'

export default function GenericDetail({
  doctype,
  basePath,
  titleField = 'name',
  statusField = 'status',
  renderContent, // function(doc, editing, setForm, form)
  onSave, // optional interceptor before save
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  const { data: doc, isLoading, mutate } = useFrappeGetDoc(doctype, id)
  const { updateDoc, loading: saving } = useFrappeUpdateDoc()

  if (isLoading) return <Loader />

  if (!doc) {
    return (
      <div className="empty-state">
        <h3 className="empty-state-title">{doctype} not found</h3>
        <button className="btn btn-secondary" onClick={() => navigate(basePath)}>
          <ArrowLeft size={16} /> Back to {doctype}s
        </button>
      </div>
    )
  }

  const startEdit = () => {
    setForm(doc) // Basic shallow copy for editing
    setEditing(true)
  }

  const handleSave = async () => {
    try {
      const dataToSave = onSave ? onSave(form) : form
      await updateDoc(doctype, id, dataToSave)
      toast.success(`${doctype} updated successfully!`)
      setEditing(false)
      mutate()
    } catch (err) {
      toast.error(err?.message || `Failed to update ${doctype}`)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="detail-header">
        <div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(basePath)}
            style={{ marginBottom: 'var(--space-3)' }}
          >
            <ArrowLeft size={16} /> Back to {doctype}s
          </button>
          <h1 className="detail-title">{doc[titleField] || doc.name}</h1>
          <div className="detail-meta">
            {statusField && doc[statusField] && (
              <span className={`badge badge-dot badge-${getStatusColor(doc[statusField])}`}>
                {doc[statusField]}
              </span>
            )}
            <span className="detail-meta-item">
              <Calendar size={14} /> Created {formatDate(doc.creation)}
            </span>
            <span className="detail-meta-item">
              <User size={14} /> {doc.owner}
            </span>
          </div>
        </div>
        <div className="page-header-actions">
          {editing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={startEdit}>Edit {doctype}</button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {renderContent(doc, editing, setForm, form)}
      </div>
    </div>
  )
}
