import { Briefcase } from 'lucide-react'
import GenericList from '../../components/ui/GenericList'
import { truncateText, formatCurrency } from '../../utils/formatters'

export default function OpportunityList() {
  return (
    <GenericList
      doctype="Opportunity"
      title="Opportunities"
      subtitle="Manage your sales pipeline"
      icon={Briefcase}
      basePath="/crm/opportunities"
      fields={['party_name', 'status', 'opportunity_amount', 'probability']}
      statusOptions={['Open', 'Quotation', 'Converted', 'Lost', 'Replied']}
      columns={[
        { label: 'ID', key: 'name' },
        { label: 'Party', key: 'party_name', format: (val) => truncateText(val, 30) },
        { label: 'Amount', key: 'opportunity_amount', format: (val) => formatCurrency(val) },
        { label: 'Status', key: 'status', format: (val) => <span className={`badge badge-dot badge-${val === 'Converted' ? 'success' : val === 'Lost' ? 'danger' : 'warning'}`}>{val}</span> },
        { label: 'Probability', key: 'probability', format: (val) => `${val || 0}%` },
      ]}
      onCreate={() => alert('Create Opportunity Modal TBD')}
    />
  )
}
