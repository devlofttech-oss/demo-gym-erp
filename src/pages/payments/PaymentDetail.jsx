import { useParams, useNavigate } from 'react-router-dom'
import { useFrappeGetDoc } from 'frappe-react-sdk'
import { ArrowLeft, Calendar, User, CreditCard, ArrowDownLeft, ArrowUpRight, Hash, FileText } from 'lucide-react'
import Loader from '../../components/ui/Loader'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters'

export default function PaymentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: payment, isLoading } = useFrappeGetDoc('Payment Entry', id)

  if (isLoading) return <Loader />

  if (!payment) {
    return (
      <div className="empty-state">
        <h3 className="empty-state-title">Payment not found</h3>
        <button className="btn btn-secondary" onClick={() => navigate('/payments')}>
          <ArrowLeft size={16} /> Back to Payments
        </button>
      </div>
    )
  }

  const statusLabel = payment.docstatus === 1 ? 'Submitted' : payment.docstatus === 2 ? 'Cancelled' : 'Draft'
  const statusColor = payment.docstatus === 1 ? 'green' : payment.docstatus === 2 ? 'red' : 'gray'

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="detail-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/payments')} style={{ marginBottom: 'var(--space-3)' }}>
            <ArrowLeft size={16} /> Back to Payments
          </button>
          <h1 className="detail-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {payment.payment_type === 'Receive' ? (
              <ArrowDownLeft size={28} style={{ color: 'var(--success)' }} />
            ) : (
              <ArrowUpRight size={28} style={{ color: 'var(--danger)' }} />
            )}
            {payment.name}
          </h1>
          <div className="detail-meta">
            <span className={`badge badge-dot badge-${statusColor}`}>{statusLabel}</span>
            <span className={`badge ${payment.payment_type === 'Receive' ? 'badge-green' : 'badge-red'}`}>
              {payment.payment_type}
            </span>
            <span className="detail-meta-item">
              <Calendar size={14} /> {formatDate(payment.posting_date)}
            </span>
          </div>
        </div>
      </div>

      {/* Amount Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', textAlign: 'center', padding: 'var(--space-10)' }}>
        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
          {payment.payment_type === 'Receive' ? 'Amount Received' : 'Amount Paid'}
        </div>
        <div style={{
          fontSize: '3rem',
          fontWeight: 800,
          background: payment.payment_type === 'Receive' ? 'linear-gradient(135deg, #34d399, #10b981)' : 'linear-gradient(135deg, #f87171, #ef4444)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1.2,
        }}>
          {formatCurrency(payment.paid_amount)}
        </div>
        {payment.paid_amount !== payment.received_amount && (
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
            Received: {formatCurrency(payment.received_amount)}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="detail-grid">
        <div className="card">
          <div className="detail-section">
            <h2>Party Details</h2>
            <div className="detail-field">
              <div className="detail-field-label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Party Type</div>
              <div className="detail-field-value">{payment.party_type || '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Party</div>
              <div className="detail-field-value">{payment.party || '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label"><CreditCard size={12} style={{ display: 'inline', marginRight: 4 }} />Mode of Payment</div>
              <div className="detail-field-value">{payment.mode_of_payment || '—'}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="detail-section">
            <h2>Transaction Details</h2>
            <div className="detail-field">
              <div className="detail-field-label"><Hash size={12} style={{ display: 'inline', marginRight: 4 }} />Reference No</div>
              <div className="detail-field-value">{payment.reference_no || '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label"><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />Reference Date</div>
              <div className="detail-field-value">{formatDate(payment.reference_date)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label"><FileText size={12} style={{ display: 'inline', marginRight: 4 }} />Paid From</div>
              <div className="detail-field-value">{payment.paid_from || '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label"><FileText size={12} style={{ display: 'inline', marginRight: 4 }} />Paid To</div>
              <div className="detail-field-value">{payment.paid_to || '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Last Modified</div>
              <div className="detail-field-value">{formatDateTime(payment.modified)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* References */}
      {payment.references && payment.references.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <div className="detail-section">
            <h2>Invoice References</h2>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Grand Total</th>
                    <th>Outstanding</th>
                    <th>Allocated</th>
                  </tr>
                </thead>
                <tbody>
                  {payment.references.map((ref, i) => (
                    <tr key={i}>
                      <td>{ref.reference_doctype}</td>
                      <td style={{ fontWeight: 600 }}>{ref.reference_name}</td>
                      <td>{formatCurrency(ref.total_amount)}</td>
                      <td>{formatCurrency(ref.outstanding_amount)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{formatCurrency(ref.allocated_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
