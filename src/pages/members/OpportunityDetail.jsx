import GenericDetail from '../../components/ui/GenericDetail'
import { Building2, DollarSign } from 'lucide-react'
import Tabs from '../../components/ui/Tabs'
import ChildTable from '../../components/ui/ChildTable'

export default function OpportunityDetail() {
  return (
    <GenericDetail
      doctype="Opportunity"
      basePath="/crm/opportunities"
      titleField="name"
      renderContent={(doc, editing, setForm, form) => {
        
        const handleActivityChange = (index, key, value) => {
          const newLogs = [...(form.activity_logs || [])]
          newLogs[index] = { ...newLogs[index], [key]: value }
          setForm({ ...form, activity_logs: newLogs })
        }
        const addActivity = () => setForm({ ...form, activity_logs: [...(form.activity_logs || []), { date: new Date().toISOString().split('T')[0] }] })
        const removeActivity = (index) => setForm({ ...form, activity_logs: (form.activity_logs || []).filter((_, i) => i !== index) })

        const handleCommChange = (index, key, value) => {
          const newComms = [...(form.communications || [])]
          newComms[index] = { ...newComms[index], [key]: value }
          setForm({ ...form, communications: newComms })
        }
        const addComm = () => setForm({ ...form, communications: [...(form.communications || []), {}] })
        const removeComm = (index) => setForm({ ...form, communications: (form.communications || []).filter((_, i) => i !== index) })

        const detailsTab = (
          <div className="card">
            <div className="detail-section">
              <h2>Opportunity Details</h2>
              {editing ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Party Name</label>
                    <input className="form-input" value={form.party_name || ''} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount</label>
                    <input type="number" className="form-input" value={form.opportunity_amount || 0} onChange={(e) => setForm({ ...form, opportunity_amount: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Probability (%)</label>
                    <input type="number" className="form-input" value={form.probability || 0} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status || 'Open'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {['Open', 'Quotation', 'Converted', 'Lost', 'Replied'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="detail-field">
                    <div className="detail-field-label"><Building2 size={12} style={{ display: 'inline', marginRight: 4 }} />Party</div>
                    <div className="detail-field-value">{doc.party_name || '—'}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label"><DollarSign size={12} style={{ display: 'inline', marginRight: 4 }} />Amount</div>
                    <div className="detail-field-value">{doc.opportunity_amount || 0}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">Probability</div>
                    <div className="detail-field-value">{doc.probability || 0}%</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )

        const activityLogTab = (
          <div className="card">
            <div className="detail-section">
              <h2>Activity Log</h2>
              <ChildTable 
                editing={editing}
                data={editing ? (form.activity_logs || []) : (doc.activity_logs || [])}
                columns={[
                  { key: 'date', label: 'Date', type: 'date' },
                  { key: 'activity_type', label: 'Activity Type' },
                  { key: 'subject', label: 'Subject' },
                  { key: 'status', label: 'Status' }
                ]}
                onChange={handleActivityChange}
                onAdd={addActivity}
                onRemove={removeActivity}
              />
            </div>
          </div>
        )

        const commsTab = (
          <div className="card">
            <div className="detail-section">
              <h2>Communications</h2>
              <ChildTable 
                editing={editing}
                data={editing ? (form.communications || []) : (doc.communications || [])}
                columns={[
                  { key: 'communication_date', label: 'Date', type: 'date' },
                  { key: 'communication_medium', label: 'Medium' },
                  { key: 'subject', label: 'Subject' },
                  { key: 'sender', label: 'Sender' }
                ]}
                onChange={handleCommChange}
                onAdd={addComm}
                onRemove={removeComm}
              />
            </div>
          </div>
        )

        return (
          <Tabs 
            tabs={[
              { id: 'details', label: 'Details', content: detailsTab },
              { id: 'activity', label: 'Activity Log', content: activityLogTab },
              { id: 'communications', label: 'Communications', content: commsTab },
            ]} 
          />
        )
      }}
    />
  )
}

