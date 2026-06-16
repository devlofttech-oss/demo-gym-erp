import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="empty-state animate-fade-in">
      <div className="empty-state-icon">
        <Icon size={28} />
      </div>
      <h3 className="empty-state-title">{title || 'No data yet'}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action}
    </div>
  )
}
