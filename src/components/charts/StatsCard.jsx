import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StatsCard({ icon: Icon, label, value, change, changeType, color = 'blue' }) {
  return (
    <div className="stats-card animate-fade-in">
      <div className={`stats-icon ${color}`}>
        <Icon size={22} />
      </div>
      <div className="stats-value">{value}</div>
      <div className="stats-label">{label}</div>
      {change && (
        <div className={`stats-change ${changeType === 'up' ? 'up' : 'down'}`}>
          {changeType === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change}
        </div>
      )}
    </div>
  )
}
