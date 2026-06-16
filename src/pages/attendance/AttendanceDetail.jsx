import GenericDetail from '../../components/ui/GenericDetail'
import { Clock, User, Calendar } from 'lucide-react'
import { formatDate } from '../../utils/formatters'
import Tabs from '../../components/ui/Tabs'
import ChildTable from '../../components/ui/ChildTable'

export default function AttendanceDetail() {
  return (
    <GenericDetail
      doctype="Timesheet"
      basePath="/attendance"
      renderContent={(doc, editing, setForm, form) => {

        const handleTimeLogChange = (index, key, value) => {
          const newLogs = [...(form.time_logs || [])]
          newLogs[index] = { ...newLogs[index], [key]: value }
          setForm({ ...form, time_logs: newLogs })
        }
        const addTimeLog = () => setForm({ ...form, time_logs: [...(form.time_logs || []), {}] })
        const removeTimeLog = (index) => setForm({ ...form, time_logs: (form.time_logs || []).filter((_, i) => i !== index) })

        const detailsTab = (
          <div className="card">
            <div className="detail-section">
              <h2>Attendance Details</h2>
              {editing ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Member / Staff Name</label>
                    <input className="form-input" value={form.employee_name || ''} onChange={(e) => setForm({ ...form, employee_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Note</label>
                    <textarea className="form-textarea" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} />
                  </div>
                </>
              ) : (
                <>
                  <div className="detail-field">
                    <div className="detail-field-label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Member / Staff</div>
                    <div className="detail-field-value">{doc.employee_name || '—'}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label"><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />Date</div>
                    <div className="detail-field-value">{formatDate(doc.start_date)}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label"><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />Total Duration</div>
                    <div className="detail-field-value">{doc.total_billed_hours || 0} hrs</div>
                  </div>
                  {doc.note && (
                    <div className="detail-field">
                      <div className="detail-field-label">Note</div>
                      <div className="detail-field-value">{doc.note}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )

        const timeLogsTab = (
          <div className="card">
            <div className="detail-section">
              <h2>Check-ins</h2>
              <ChildTable 
                editing={editing}
                data={editing ? (form.time_logs || []) : (doc.time_logs || [])}
                columns={[
                  { key: 'activity_type', label: 'Activity' },
                  { key: 'from_time', label: 'Check-in Time', type: 'datetime-local' },
                  { key: 'to_time', label: 'Check-out Time', type: 'datetime-local' },
                  { key: 'hours', label: 'Duration (hrs)', type: 'number' }
                ]}
                onChange={handleTimeLogChange}
                onAdd={addTimeLog}
                onRemove={removeTimeLog}
              />
            </div>
          </div>
        )

        return (
          <Tabs 
            tabs={[
              { id: 'details', label: 'Details', content: detailsTab },
              { id: 'timelogs', label: 'Check-ins', content: timeLogsTab },
            ]} 
          />
        )
      }}
    />
  )
}

