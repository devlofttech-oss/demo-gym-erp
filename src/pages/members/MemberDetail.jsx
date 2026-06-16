import GenericDetail from '../../components/ui/GenericDetail'
import { Users, Phone, Calendar, Star } from 'lucide-react'
import { formatDate, formatCurrency } from '../../utils/formatters'
import Tabs from '../../components/ui/Tabs'
import { useFrappeGetDocList } from 'frappe-react-sdk'
import Loader from '../../components/ui/Loader'

function MemberPayments({ memberId }) {
  const { data: payments, isLoading } = useFrappeGetDocList('Payment Entry', {
    fields: ['name', 'posting_date', 'paid_amount', 'remarks', 'docstatus'],
    filters: [['party', '=', memberId]],
    orderBy: { field: 'creation', order: 'desc' },
  })

  if (isLoading) return <Loader />

  return (
    <div className="data-table-container" style={{ marginTop: '1rem' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Plan / Notes</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {!payments || payments.length === 0 ? (
            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recent payments found.</td></tr>
          ) : (
            payments.map(p => (
              <tr key={p.name}>
                <td>{formatDate(p.posting_date)}</td>
                <td>{p.remarks || '—'}</td>
                <td style={{ fontWeight: 600 }}>{formatCurrency(p.paid_amount)}</td>
                <td>
                  <span className={`badge badge-dot badge-${p.docstatus === 1 ? 'success' : p.docstatus === 2 ? 'danger' : 'muted'}`}>
                    {p.docstatus === 1 ? 'Completed' : p.docstatus === 2 ? 'Cancelled' : 'Draft'}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function MemberAttendance({ memberId }) {
  const { data: attendance, isLoading } = useFrappeGetDocList('Gym Checkin', {
    fields: ['name', 'time', 'status', 'source'],
    filters: [['member', '=', memberId]],
    orderBy: { field: 'creation', order: 'desc' },
    limit: 50
  })

  if (isLoading) return <Loader />

  return (
    <div className="data-table-container" style={{ marginTop: '1rem' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Source</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {!attendance || attendance.length === 0 ? (
            <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No check-in logs found.</td></tr>
          ) : (
            attendance.map(a => (
              <tr key={a.name}>
                <td>{formatDate(a.time, true) || a.time}</td>
                <td>{a.source || 'Manual'}</td>
                <td>
                  <span className={`badge badge-dot badge-${a.status === 'Granted' ? 'success' : 'danger'}`}>
                    {a.status}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function MemberDetail() {
  return (
    <GenericDetail
      doctype="Customer"
      basePath="/members"
      titleField="customer_name"
      statusField="custom_membership_status"
      renderContent={(doc, editing, setForm, form) => {
        
        const detailsTab = (
          <div className="card">
            <div className="detail-section">
              <h2>Member Profile</h2>
              {editing ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Member Name</label>
                    <input className="form-input" value={form.customer_name || ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={form.mobile_no || ''} onChange={(e) => setForm({ ...form, mobile_no: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Joining</label>
                    <input type="date" className="form-input" value={form.custom_date_of_joining || ''} onChange={(e) => setForm({ ...form, custom_date_of_joining: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Current Plan</label>
                    <input className="form-input" value={form.custom_current_plan || ''} onChange={(e) => setForm({ ...form, custom_current_plan: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date</label>
                    <input type="date" className="form-input" value={form.custom_expiry_date || ''} onChange={(e) => setForm({ ...form, custom_expiry_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Membership Status</label>
                    <select 
                      className="form-select" 
                      value={form.custom_membership_status || 'Active'} 
                      onChange={(e) => setForm({ ...form, custom_membership_status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Expired">Expired</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="detail-field">
                    <div className="detail-field-label"><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />Phone</div>
                    <div className="detail-field-value">{doc.mobile_no || '—'}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label"><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />Date of Joining</div>
                    <div className="detail-field-value">{formatDate(doc.custom_date_of_joining)}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label"><Star size={12} style={{ display: 'inline', marginRight: 4 }} />Current Plan</div>
                    <div className="detail-field-value">{doc.custom_current_plan || '—'}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label"><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />Expiry Date</div>
                    <div className="detail-field-value">{formatDate(doc.custom_expiry_date)}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">Status</div>
                    <div className="detail-field-value">
                      <span className={`badge badge-dot badge-${doc.custom_membership_status === 'Active' ? 'success' : doc.custom_membership_status === 'Expired' ? 'danger' : 'muted'}`}>
                        {doc.custom_membership_status || '—'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )

        const paymentsTab = (
          <div className="card">
            <div className="detail-section">
              <h2>Payment History</h2>
              <MemberPayments memberId={doc.name} />
            </div>
          </div>
        )

        const attendanceTab = (
          <div className="card">
            <div className="detail-section">
              <h2>Attendance Logs</h2>
              <MemberAttendance memberId={doc.name} />
            </div>
          </div>
        )

        return (
          <Tabs 
            tabs={[
              { id: 'details', label: 'Profile', content: detailsTab },
              { id: 'payments', label: 'Payments', content: paymentsTab },
              { id: 'attendance', label: 'Attendance', content: attendanceTab },
            ]} 
          />
        )
      }}
    />
  )
}

