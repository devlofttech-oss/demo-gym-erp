import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogIn } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, currentUser, inactiveGymError } = useAuth()
  const navigate = useNavigate()

  // If already logged in, redirect
  if (currentUser) {
    navigate('/', { replace: true })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-slate-900 p-4 font-['Plus_Jakarta_Sans']">
      <div className="bg-surface-container-lowest dark:bg-slate-950 w-full max-w-md p-8 md:p-10 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.4)] border border-outline-variant/30 flex flex-col items-center">
        
        <h1 className="text-3xl font-extrabold text-on-surface text-center mb-1 tracking-tight">GYM-OS</h1>
        <p className="text-primary font-medium text-center text-sm mb-1">by Devloft Technologies</p>
        <p className="text-on-surface-variant text-center mb-8 text-sm mt-3">Sign in to your management dashboard</p>

        {inactiveGymError && (
          <div className="w-full p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 rounded-xl text-sm font-medium text-center flex items-center gap-2 justify-center">
            <span className="material-symbols-outlined text-[16px]">block</span>
            Your gym account is currently inactive. Please contact support.
          </div>
        )}

        {error && (
          <div className="w-full p-3 mb-6 bg-error-container text-on-error-container rounded-xl text-sm font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-sm font-semibold text-on-surface">Email address</label>
            <input
              id="login-email"
              type="email"
              className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface outline-none transition-all"
              placeholder="admin@deepfitness.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-sm font-semibold text-on-surface">Password</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                tabIndex={-1}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 bg-primary hover:bg-primary/90 text-on-primary font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-70"
            disabled={loading}
            id="login-submit"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
            ) : (
              <>
                <LogIn size={20} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-1 opacity-70">
          <p className="text-center text-xs text-on-surface-variant">
            Developed by DevLoft Tech
          </p>
          <a 
            href="https://www.devlofttech.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary dark:text-amber-100 hover:text-primary/80 dark:hover:text-amber-50 transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-[14px]">language</span>
            Visit Website
          </a>
        </div>
      </div>
    </div>
  )
}
