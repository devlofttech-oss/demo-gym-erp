import { AlertCircle } from 'lucide-react'
import GenericList from '../../components/ui/GenericList'
import { truncateText, formatDate } from '../../utils/formatters'

export default function DuesPage() {
  return (
    <GenericList
      doctype="Customer"
      title="Pending Dues & Expired"
      subtitle="Track members with expired plans or pending payments"
      icon={AlertCircle}
      basePath="/members" // Link to member profile
      // Only requesting standard fields to avoid 417 Expectation Failed.
      // Once custom fields are created, add them back: 'custom_current_plan', 'custom_expiry_date', 'custom_membership_status'
      fields={['customer_name', 'mobile_no']}
      searchField="customer_name"
      statusField={null}
      columns={[
        { label: 'Member Name', key: 'customer_name', format: (val) => truncateText(val, 30) },
        { label: 'Phone', key: 'mobile_no' },
        { label: 'Plan', key: 'custom_current_plan' },
        { label: 'Expiry Date', key: 'custom_expiry_date', format: (val) => val ? <span style={{ color: 'var(--danger)' }}>{formatDate(val)}</span> : '—' },
        { 
          label: 'Status', 
          key: 'custom_membership_status',
          format: (val) => (
            <span className={`badge badge-dot badge-${val === 'Active' ? 'success' : val === 'Expired' ? 'danger' : 'muted'}`}>
              {val || '—'}
            </span>
          )
        },
      ]}
    />
  )
}
