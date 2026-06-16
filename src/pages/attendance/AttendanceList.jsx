import { Clock } from 'lucide-react'
import GenericList from '../../components/ui/GenericList'
import { truncateText, formatDate } from '../../utils/formatters'

export default function AttendanceList() {
  return (
    <GenericList
      doctype="Gym Checkin"
      title="Attendance Logs"
      subtitle="Track member check-ins"
      icon={Clock}
      basePath="/attendance"
      fields={['member', 'member_name', 'status', 'time']}
      statusOptions={['Granted', 'Denied']}
      columns={[
        { label: 'Check-in ID', key: 'name' },
        { label: 'Member Name', key: 'member_name', format: (val) => truncateText(val, 30) },
        { label: 'Time', key: 'time', format: (val) => formatDate(val) },
        { label: 'Status', key: 'status', format: (val) => <span className={`badge badge-dot badge-${val === 'Granted' ? 'success' : 'danger'}`}>{val}</span> },
      ]}
      onCreate={() => window.open('/checkin', '_blank')} // Opens the standalone checkin portal
    />
  )
}
