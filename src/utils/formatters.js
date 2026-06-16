/* Utility functions & format helpers */

export function formatCurrency(amount, currency = 'INR') {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function getStatusColor(status) {
  const map = {
    // Lead statuses
    'Lead': 'blue',
    'Open': 'blue',
    'Replied': 'violet',
    'Opportunity': 'violet',
    'Quotation': 'yellow',
    'Lost Quotation': 'red',
    'Interested': 'green',
    'Converted': 'green',
    'Do Not Contact': 'red',
    // Project statuses
    'Completed': 'green',
    'Cancelled': 'red',
    'Overdue': 'red',
    // Task statuses
    'Working': 'yellow',
    'Pending Review': 'yellow',
    'Template': 'gray',
    // Payment statuses
    'Submitted': 'green',
    'Draft': 'gray',
    'Cancelled': 'red',
  }
  return map[status] || 'gray'
}

export function truncateText(text, max = 60) {
  if (!text || text.length <= max) return text
  return text.substring(0, max) + '…'
}
