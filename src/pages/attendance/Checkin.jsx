import { useState } from 'react'
import { CheckCircle, XCircle, Search, ArrowLeft } from 'lucide-react'
import { useFrappeCreateDoc } from 'frappe-react-sdk'
import { Link } from 'react-router-dom'

export default function Checkin() {
  const [memberId, setMemberId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { status: 'success' | 'error', message: string, memberName?: string }

  const { createDoc } = useFrappeCreateDoc()

  const handleCheckin = async (e) => {
    e.preventDefault()
    if (!memberId) return

    setLoading(true)
    setResult(null)

    try {
      // 1. Search Customer by Phone or ID
      // First try searching by mobile_no (standard Frappe field)
      // Using fields=["*"] instead of specifying custom fields prevents 417 Expectation Failed errors 
      // if the backend custom fields haven't been created yet.
      let searchRes = await fetch(`/api/resource/Customer?filters=[["mobile_no","=","${memberId}"]]&fields=["*"]`)
      let data = await searchRes.json()

      let member = data.data && data.data.length > 0 ? data.data[0] : null

      // If not found by phone, try searching by name (ID)
      if (!member) {
        searchRes = await fetch(`/api/resource/Customer?filters=[["name","=","${memberId}"]]&fields=["*"]`)
        data = await searchRes.json()
        member = data.data && data.data.length > 0 ? data.data[0] : null
      }

      // 2. Validate Member
      if (!member) {
        setResult({ status: 'error', message: 'Member Not Found. Please check the Phone number or ID.' })
        setLoading(false)
        return
      }

      if (member.custom_membership_status && member.custom_membership_status !== 'Active') {
        setResult({ status: 'error', message: `Access Denied: Membership is ${member.custom_membership_status || 'Inactive'}` })
        setLoading(false)
        return
      }

      if (member.custom_expiry_date && new Date(member.custom_expiry_date) < new Date()) {
        setResult({ status: 'error', message: 'Access Denied: Membership has Expired' })
        setLoading(false)
        return
      }

      // 3. Create Gym Checkin Record
      await createDoc('Gym Checkin', {
        member: member.name,
        member_name: member.customer_name,
        time: new Date().toISOString().replace('T', ' ').split('.')[0], // Frappe datetime format approx
        status: 'Granted',
        source: 'QR / Kiosk'
      })

      // 4. Show Success
      setResult({
        status: 'success',
        memberName: member.customer_name,
        message: 'Attendance Marked Successfully'
      })

    } catch (err) {
      console.error("Checkin flow failed:", err)
      setResult({ status: 'error', message: 'An error occurred during check-in. Make sure Custom Fields and Gym Checkin DocType exist.' })
    } finally {
      setLoading(false)
      setMemberId('')
    }
  }

  const reset = () => {
    setResult(null)
    setMemberId('')
  }

  if (result) {
    const isSuccess = result.status === 'success'
    return (
      <div className="checkin-container" style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: isSuccess ? 'var(--success)' : 'var(--danger)',
        color: '#fff',
        padding: 'var(--space-6)',
        textAlign: 'center'
      }}>
        {isSuccess ? <CheckCircle size={80} style={{ marginBottom: 'var(--space-6)' }} /> : <XCircle size={80} style={{ marginBottom: 'var(--space-6)' }} />}
        
        <h1 style={{ fontSize: '32px', marginBottom: 'var(--space-2)' }}>
          {isSuccess ? 'Access Granted' : 'Access Denied'}
        </h1>
        
        {isSuccess && <h2 style={{ fontSize: '24px', opacity: 0.9, marginBottom: 'var(--space-4)' }}>Welcome, {result.memberName}</h2>}
        
        <p style={{ fontSize: '18px', opacity: 0.8, maxWidth: '400px' }}>{result.message}</p>

        <button 
          onClick={reset}
          style={{ 
            marginTop: 'var(--space-8)',
            padding: '1rem 2rem',
            fontSize: '18px',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Check In Another Member
        </button>
      </div>
    )
  }

  return (
    <div className="checkin-container" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      background: 'var(--bg-color)',
      padding: 'var(--space-8) var(--space-4)'
    }}>
      <div style={{ position: 'absolute', top: '1rem', left: '1rem' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to ERP
        </Link>
      </div>

      <div className="brand" style={{ textAlign: 'center', marginBottom: 'var(--space-8)', marginTop: 'var(--space-8)' }}>
        <div style={{ width: '64px', height: '64px', background: 'var(--primary)', color: '#fff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', margin: '0 auto var(--space-4)' }}>
          GO
        </div>
        <h1 style={{ fontSize: '28px', color: 'var(--text-color)' }}>GYM-OS</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Member Check-in Portal</p>
      </div>

      <form onSubmit={handleCheckin} style={{ width: '100%', maxWidth: '400px', background: 'var(--surface)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
        <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
          <label className="form-label" style={{ fontSize: '16px', marginBottom: 'var(--space-2)' }}>Phone Number or Member ID</label>
          <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Enter ID or Phone..." 
              value={memberId}
              onChange={e => setMemberId(e.target.value)}
              style={{ paddingLeft: '48px', paddingRight: '16px', paddingTop: '16px', paddingBottom: '16px', fontSize: '18px' }}
              autoFocus
              required
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '16px', fontSize: '18px', display: 'flex', justifyContent: 'center' }}
          disabled={loading || !memberId}
        >
          {loading ? 'Verifying...' : 'Check In'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', color: 'var(--text-muted)', fontSize: '14px' }}>
          Or scan your QR code at the scanner below.
        </p>
      </form>
    </div>
  )
}
