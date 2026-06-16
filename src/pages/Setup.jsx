import { useState } from 'react'
import { Database, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

export default function Setup() {
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState([])

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }])
  }

  const handleSetup = async () => {
    setLoading(true)
    setLogs([])
    addLog('Starting automated Frappe backend setup...')

    const customFields = [
      {
        dt: "Customer", fieldname: "custom_phone", label: "Phone", fieldtype: "Data", insert_after: "customer_name"
      },
      {
        dt: "Customer", fieldname: "custom_date_of_joining", label: "Date of Joining", fieldtype: "Date", insert_after: "custom_phone"
      },
      {
        dt: "Customer", fieldname: "custom_membership_status", label: "Membership Status", fieldtype: "Select", options: "Active\nExpired\nInactive", default: "Active", insert_after: "custom_date_of_joining"
      },
      {
        dt: "Customer", fieldname: "custom_current_plan", label: "Current Plan", fieldtype: "Data", insert_after: "custom_membership_status"
      },
      {
        dt: "Customer", fieldname: "custom_expiry_date", label: "Expiry Date", fieldtype: "Date", insert_after: "custom_current_plan"
      }
    ]

    const docTypes = [
      {
        name: "Gym Checkin",
        module: "Custom",
        custom: 1,
        autoname: "format:CHK-{YYYY}-{MM}-{####}",
        fields: [
          { fieldname: "member", fieldtype: "Link", options: "Customer", label: "Member", in_list_view: 1, reqd: 1 },
          { fieldname: "member_name", fieldtype: "Data", label: "Member Name", in_list_view: 1 },
          { fieldname: "time", fieldtype: "Datetime", label: "Time", in_list_view: 1, reqd: 1 },
          { fieldname: "status", fieldtype: "Select", options: "Granted\nDenied", label: "Status", in_list_view: 1 },
          { fieldname: "source", fieldtype: "Data", label: "Source" }
        ],
        permissions: [
          { role: "System Manager", read: 1, write: 1, create: 1, delete: 1, submit: 0, cancel: 0, amend: 0 }
        ]
      }
    ]

    // 1. Create Custom Fields
    for (const field of customFields) {
      try {
        const res = await fetch('/api/resource/Custom Field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(field)
        })
        
        if (res.status === 409) {
          addLog(`Custom Field '${field.fieldname}' already exists.`, 'success')
        } else if (!res.ok) {
          const err = await res.json()
          addLog(`Failed to create '${field.fieldname}': ${JSON.stringify(err)}`, 'error')
        } else {
          addLog(`Created Custom Field '${field.fieldname}'.`, 'success')
        }
      } catch (err) {
        addLog(`Error on '${field.fieldname}': ${err.message}`, 'error')
      }
    }

    // 2. Create DocTypes
    for (const dt of docTypes) {
      try {
        const res = await fetch('/api/resource/DocType', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dt)
        })
        
        if (res.status === 409) {
          addLog(`DocType '${dt.name}' already exists.`, 'success')
        } else if (!res.ok) {
          const err = await res.json()
          // Frappe sometimes throws 500 or validation errors if it exists but is slightly different
          if (JSON.stringify(err).includes('Duplicate')) {
             addLog(`DocType '${dt.name}' already exists.`, 'success')
          } else {
             addLog(`Failed to create DocType '${dt.name}': ${JSON.stringify(err)}`, 'error')
          }
        } else {
          addLog(`Created DocType '${dt.name}'.`, 'success')
        }
      } catch (err) {
        addLog(`Error on DocType '${dt.name}': ${err.message}`, 'error')
      }
    }

    addLog('Setup complete! If no errors occurred, your backend is fully ready.', 'info')
    setLoading(false)
    toast.success('Setup execution finished')
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>System Setup</h1>
          <p>Automated backend bootstrap for new client deployments</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', padding: '1rem', borderRadius: '50%' }}>
            <Database size={24} />
          </div>
          <div>
            <h2 style={{ marginBottom: '0.5rem' }}>Deploy Gym ERP Schema</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Clicking the button below will automatically send API requests to your connected ERPNext instance to create all the necessary database structures (Custom Fields and DocTypes) required by this React application.
            </p>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '14px' }}>
              Note: It is safe to run this multiple times. It will skip structures that already exist.
            </p>
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '1rem', fontSize: '16px', display: 'flex', justifyContent: 'center' }}
          onClick={handleSetup}
          disabled={loading}
        >
          {loading ? <><RefreshCw size={18} className="spin" /> Provisioning Database...</> : 'Initialize Backend Schema'}
        </button>
      </div>

      {logs.length > 0 && (
        <div className="card" style={{ background: '#1e1e24', borderColor: '#333' }}>
          <h3 style={{ marginBottom: '1rem', color: '#fff' }}>Execution Logs</h3>
          <div style={{ fontFamily: 'monospace', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ 
                color: log.type === 'error' ? '#ff6b6b' : log.type === 'success' ? '#51cf66' : '#abb2bf',
                display: 'flex',
                gap: '12px'
              }}>
                <span style={{ color: '#5c6370', minWidth: '80px' }}>[{log.time}]</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {log.type === 'success' && <CheckCircle size={14} />}
                  {log.type === 'error' && <AlertCircle size={14} />}
                  {log.msg}
                </span>
              </div>
            ))}
          </div>
          {!loading && (
             <div style={{ marginTop: '2rem', textAlign: 'center' }}>
               <Link to="/" className="btn btn-secondary">Return to Dashboard</Link>
             </div>
          )}
        </div>
      )}
    </div>
  )
}
