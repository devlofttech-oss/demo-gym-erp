import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFrappeGetDocList, useFrappeCreateDoc } from 'frappe-react-sdk'
import { Plus, CreditCard, Search, Eye, ArrowDownLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../components/ui/Modal'
import Loader from '../../components/ui/Loader'
import EmptyState from '../../components/ui/EmptyState'
import StatsCard from '../../components/charts/StatsCard'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { PAYMENT_MODES, PAGE_SIZE } from '../../utils/constants'

export default function PaymentList() {
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(0)

  const [form, setForm] = useState({
    party: '',
    paid_amount: '',
    mode_of_payment: 'Cash',
    posting_date: new Date().toISOString().split('T')[0],
    remarks: '', // Used for plan name or notes
  })

  const filters = [['payment_type', '=', 'Receive'], ['party_type', '=', 'Customer']]
  if (searchTerm) filters.push(['party', 'like', `%${searchTerm}%`])

  const { data: payments, isLoading, mutate } = useFrappeGetDocList('Payment Entry', {
    fields: ['name', 'party', 'paid_amount', 'mode_of_payment', 'posting_date', 'docstatus', 'remarks'],
    filters: filters,
    orderBy: { field: 'creation', order: 'desc' },
    limit: PAGE_SIZE,
    start: page * PAGE_SIZE,
  })

  // Fetch Members for Dropdown
  const { data: membersList } = useFrappeGetDocList('Customer', {
    fields: ['name', 'customer_name'],
    limit: 1000,
  })

  // Fetch Company Defaults for Payment Entry Accounts
  const { data: companyData } = useFrappeGetDocList('Company', {
    fields: ['name', 'abbr', 'default_currency', 'default_cash_account', 'default_receivable_account'],
    limit: 1,
  })

  // Stats: Frappe REST API does not support sum() in fields. We fetch top 1000 and sum in JS.
  const { data: allReceived } = useFrappeGetDocList('Payment Entry', {
    fields: ['paid_amount'],
    filters: [['payment_type', '=', 'Receive'], ['docstatus', '=', 1], ['party_type', '=', 'Customer']],
    limit: 1000,
  })

  const totalReceived = allReceived?.reduce((acc, curr) => acc + (curr.paid_amount || 0), 0) || 0

  const { createDoc, loading: creating } = useFrappeCreateDoc()

  const handleCreate = async (e) => {
    e.preventDefault()
    
    if (!companyData || companyData.length === 0) {
      toast.error('Company defaults not loaded. Please wait or check Frappe settings.')
      return
    }

    const company = companyData[0]
    
    // Guess account names if defaults aren't strictly set in ERPNext
    const paidToAccount = company.default_cash_account || `Cash - ${company.abbr}`
    const paidFromAccount = company.default_receivable_account || `Debtors - ${company.abbr}`

    try {
      await createDoc('Payment Entry', {
        payment_type: 'Receive',
        party_type: 'Customer',
        party: form.party,
        company: company.name,
        paid_from: paidFromAccount,
        paid_to: paidToAccount,
        paid_from_account_currency: company.default_currency,
        paid_to_account_currency: company.default_currency,
        paid_amount: parseFloat(form.paid_amount),
        received_amount: parseFloat(form.paid_amount),
        base_paid_amount: parseFloat(form.paid_amount),
        base_received_amount: parseFloat(form.paid_amount),
        mode_of_payment: form.mode_of_payment || 'Cash',
        remarks: form.remarks || undefined,
        posting_date: form.posting_date,
        target_exchange_rate: 1, // Fix for multi-currency validation
        source_exchange_rate: 1,
      })
      toast.success('Payment recorded successfully!')
      setShowCreate(false)
      setForm({
        party: '', paid_amount: '', mode_of_payment: 'Cash',
        posting_date: new Date().toISOString().split('T')[0], remarks: ''
      })
      mutate()
    } catch (err) {
      console.error(err)
      toast.error(err?.message || 'Failed to record payment. Check configuration.')
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Payments</h1>
          <p>Record and view member payments</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-payment-btn">
            <Plus size={18} /> Record Payment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid stagger-children" style={{ gridTemplateColumns: 'repeat(1, 1fr)', maxWidth: '400px' }}>
        <StatsCard icon={ArrowDownLeft} label="Total Collected" value={formatCurrency(totalReceived)} color="green" />
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text" className="form-input" placeholder="Search by member name..."
            value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            style={{ paddingLeft: 36 }} id="payment-search"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {isLoading ? (
          <Loader />
        ) : !payments || payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments found"
            description="Record your first member payment"
            action={
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={18} /> Record Payment</button>
            }
          />
        ) : (
          <>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Member</th>
                    <th>Plan / Notes</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.name} onClick={() => navigate(`/payments/${p.name}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 'var(--font-xs)' }}>{p.name}</td>
                      <td>{p.party || '—'}</td>
                      <td>{p.remarks || '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(p.paid_amount)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.mode_of_payment || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatDate(p.posting_date)}</td>
                      <td>
                        <span className={`badge badge-dot badge-${p.docstatus === 1 ? 'success' : p.docstatus === 2 ? 'danger' : 'muted'}`}>
                          {p.docstatus === 1 ? 'Completed' : p.docstatus === 2 ? 'Cancelled' : 'Draft'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/payments/${p.name}`); }}>
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span className="pagination-info">Showing {page * PAGE_SIZE + 1}—{page * PAGE_SIZE + payments.length}</span>
              <div className="pagination-controls">
                <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <button className="btn btn-secondary btn-sm" disabled={payments.length < PAGE_SIZE} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate} onClose={() => setShowCreate(false)} title="Record Payment" size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !form.party || !form.paid_amount}>
            {creating ? 'Recording...' : 'Mark Paid'}
          </button>
        </>}
      >
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Member Name *</label>
            <select 
              className="form-select" 
              value={form.party} 
              onChange={(e) => setForm({ ...form, party: e.target.value })} 
              required
            >
              <option value="" disabled>Select a member...</option>
              {membersList?.map((m) => (
                <option key={m.name} value={m.name}>{m.customer_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Plan / Notes</label>
            <input className="form-input" placeholder="e.g. Annual Membership" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Amount Paid *</label>
            <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select className="form-select" value={form.mode_of_payment} onChange={(e) => setForm({ ...form, mode_of_payment: e.target.value })}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Payment Date</label>
            <input className="form-input" type="date" value={form.posting_date} onChange={(e) => setForm({ ...form, posting_date: e.target.value })} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
