import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import Icon from '../components/Icon'
import { requestJson } from '../api/client'
import './AuthPage.css'

export default function AuthPage({ initialError = '', initialMode = 'login', onClose }) {
  const { signIn, register } = useAuth()
  const [mode, setMode] = useState(initialMode === 'register' ? 'register-email' : initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [registrationTicket, setRegistrationTicket] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState(initialError)
  const [success, setSuccess] = useState('')
  const [toast, setToast] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEmailStep = mode === 'register-email'
  const isVerifying = mode === 'register-verify'
  const isDetailsStep = mode === 'register-details'
  const isForgotEmail = mode === 'forgot-email'
  const isForgotReset = mode === 'forgot-reset'
  const isPasswordReset = isForgotEmail || isForgotReset
  const isRegistering = isEmailStep || isVerifying || isDetailsStep

  const handleClose = useCallback(() => {
    if (isRegistering && !window.confirm('Your account has not been created yet. If you close now, no account will be created. Close registration?')) return
    onClose()
  }, [isRegistering, onClose])

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [handleClose])

  function changeMode(nextMode) {
    setMode(nextMode)
    setError('')
    setSuccess('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      if (isEmailStep) {
        const result = await requestJson('/api/auth/registration/send-code', { method:'POST', body:JSON.stringify({ email }) })
        setMode('register-verify')
        setSuccess(result.message)
      } else if (isVerifying) {
        const result = await requestJson('/api/auth/registration/verify-code', { method:'POST', body:JSON.stringify({ email, code:verificationCode }) })
        setRegistrationTicket(result.registrationTicket)
        setMode('register-details')
        setSuccess(result.message)
      } else if (isForgotEmail) {
        const result=await requestJson('/api/auth/password/forgot',{method:'POST',body:JSON.stringify({email})})
        setMode('forgot-reset');setSuccess(result.message)
      } else if (isForgotReset) {
        const result=await requestJson('/api/auth/password/reset',{method:'POST',body:JSON.stringify({email,code:verificationCode,password})})
        setMode('login');setPassword('');setVerificationCode('');setSuccess(result.message)
      } else if (isDetailsStep) {
        const result = await register({ name, email, password, confirmPassword, registrationTicket })
        setPassword('')
        setConfirmPassword('')
        setMode('login')
        setSuccess(result.message)
      } else {
        await signIn({ email, password })
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-overlay" onMouseDown={(event) => event.target === event.currentTarget && handleClose()}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        {toast && <div className="auth-toast" role="status"><Icon name="check" size={15}/>{toast}</div>}
        <div className="auth-dialog-heading">
          <a className="auth-brand" href="#top" onClick={onClose}>
            <span className="brand-mark"><img alt="" src="/tracklap-logo.svg" /></span>
            TRACK<span>LAP</span>
          </a>
          <button className="icon-button auth-close" onClick={handleClose} aria-label="Close dialog" type="button"><Icon name="close" size={19} /></button>
        </div>
        <div className="auth-form-wrap">
          <p className="eyebrow">{isRegistering ? isEmailStep ? 'GET STARTED' : isVerifying ? 'EMAIL VERIFICATION' : 'ACCOUNT DETAILS' : isPasswordReset?'PASSWORD RECOVERY':'WELCOME BACK'}</p>
          <h2 id="auth-title">{isEmailStep ? 'Start with your email' : isVerifying ? 'Enter your verification code' : isDetailsStep ? 'Complete your account' : isForgotEmail?'Reset your password':isForgotReset?'Enter reset code':'Sign in to Tracklap'}</h2>
          <p className="auth-subtitle">{isEmailStep ? 'We’ll send you a one-time code to verify your address.' : isVerifying ? `Enter the 6-digit code sent to ${email}.` : isDetailsStep ? `Email verified: ${email}` : isForgotEmail?'Enter your email and we’ll send a reset code.':isForgotReset?`Enter the code sent to ${email} and choose a new password.`:'Enter your details to access your workspace.'}</p>

          <form className="auth-form" onSubmit={submit}>
            {isDetailsStep && (
              <label className="form-field">
                <span>Your name</span>
                <input autoComplete="name" autoFocus maxLength="100" onChange={(event) => setName(event.target.value)} placeholder="Enter your name" required value={name} />
              </label>
            )}
            {(isEmailStep||isForgotEmail) && <label className="form-field"><span>Email address</span><input autoFocus autoComplete="email" onChange={(event)=>setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email}/></label>}
            {(isVerifying||isForgotReset) && <label className="form-field"><span>6-digit code</span><input autoFocus inputMode="numeric" maxLength="6" onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ''))} pattern="[0-9]{6}" required value={verificationCode} /></label>}
            {!isRegistering&&!isPasswordReset && <label className="form-field">
              <span>Email address</span>
              <input autoComplete="email" autoFocus={!isRegistering} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
            </label>}
            {!isRegistering&&!isPasswordReset && <label className="form-field">
              <span>Password</span>
              <div className="password-input-wrap">
                <input autoComplete="current-password" maxLength="128" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required type={showPassword ? 'text' : 'password'} value={password} />
                <button aria-label={showPassword ? 'Hide password' : 'Show password'} className="password-toggle-button" onClick={() => setShowPassword((prev) => !prev)} title={showPassword ? 'Hide password' : 'Show password'} type="button">
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
            </label>}
            {(isDetailsStep||isForgotReset) && <label className="form-field">
              <span>{isDetailsStep?'Password':'New password'}</span>
              <div className="password-input-wrap">
                <input autoComplete="new-password" maxLength="128" minLength="8" onChange={(event)=>setPassword(event.target.value)} placeholder="At least 8 characters" required type={showPassword ? 'text' : 'password'} value={password}/>
                <button aria-label={showPassword ? 'Hide password' : 'Show password'} className="password-toggle-button" onClick={() => setShowPassword((prev) => !prev)} title={showPassword ? 'Hide password' : 'Show password'} type="button">
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
            </label>}
            {isDetailsStep && <label className="form-field">
              <span>Confirm password</span>
              <div className="password-input-wrap">
                <input autoComplete="new-password" maxLength="128" minLength="8" onChange={(event)=>setConfirmPassword(event.target.value)} placeholder="Re-enter your password" required type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}/>
                <button aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} className="password-toggle-button" onClick={() => setShowConfirmPassword((prev) => !prev)} title={showConfirmPassword ? 'Hide password' : 'Show password'} type="button">
                  <Icon name={showConfirmPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
            </label>}
            {success && !isRegistering && <p className="auth-success" role="status">{success}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">{isSubmitting ? 'Please wait...' : isEmailStep ? 'Send verification code' : isVerifying ? 'Verify code' : isDetailsStep ? 'Create account' : isForgotEmail?'Send reset code':isForgotReset?'Reset password':'Sign in'}<Icon name="arrow" size={16} /></button>
          </form>
          {!isRegistering&&!isPasswordReset&&<button className="text-button" onClick={()=>{setMode('forgot-email');setError('');setSuccess('')}} type="button">Forgot password?</button>}
          {isVerifying && <button className="text-button" onClick={async () => { try { await requestJson('/api/auth/registration/send-code', { method:'POST', body:JSON.stringify({email}) }); setError(''); setToast('A new verification code has been sent to your email.'); window.setTimeout(()=>setToast(''),3500) } catch (requestError) { setError(requestError.message) } }} type="button">Resend code</button>}

          <p className="auth-switch">
            {isRegistering ? 'Already have an account?' : isPasswordReset?'Back to sign in':'New to Tracklap?'}
            <button onClick={() => changeMode(isRegistering ? 'login' : isPasswordReset?'login':'register-email')} type="button">{isRegistering||isPasswordReset ? 'Sign in' : 'Create an account'}</button>
          </p>
          <p className="auth-privacy">Your tasks and notes are private to your account unless you choose to share work with a team.</p>
        </div>
      </section>
    </div>
  )
}
