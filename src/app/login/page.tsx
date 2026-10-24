'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Wordmark } from '@/components/vantra/Primitives'
import s from './login.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setError('Could not sign in. Check your email and password, then try again.')
        setLoading(false)
        return
      }
      router.replace('/home')
      router.refresh()
    } catch {
      setError('Could not connect. Please check your connection and try again.')
      setLoading(false)
    }
  }

  return <div className={s.page}>
    <div className={s.ambient} aria-hidden="true" />
    <header className={s.header}>
      <span className={s.brand} role="img" aria-label="VANTRA"><Wordmark /></span>
      <span className={s.memberLabel}><LockKeyhole size={12} /> Member access</span>
    </header>
    <main className={s.main}>
      <section className={s.hero} aria-label="Your world of stories">
        <div className={s.artwork} aria-hidden="true">
          <svg viewBox="0 0 680 740" fill="none">
            <defs><linearGradient id="login-beam" x1="120" y1="60" x2="540" y2="640" gradientUnits="userSpaceOnUse"><stop stopColor="#e50914" stopOpacity=".06" /><stop offset=".5" stopColor="#ff2635" stopOpacity=".9" /><stop offset="1" stopColor="#e50914" stopOpacity=".08" /></linearGradient></defs>
            <path d="M95 70 340 665 585 70" stroke="url(#login-beam)" strokeWidth="2" />
            <path d="M126 70 340 590 554 70" stroke="url(#login-beam)" strokeWidth="1" opacity=".25" />
            <path d="M95 70 340 665 585 70" stroke="#e50914" strokeWidth="42" opacity=".025" />
            <ellipse cx="340" cy="400" rx="310" ry="112" stroke="#ffffff" strokeOpacity=".035" transform="rotate(-30 340 400)" />
          </svg>
        </div>
        <div className={s.heroCopy}>
          <p className={s.eyebrow}><span /> A world worth getting lost in</p>
          <p className={s.headline}>Great stories.<br />Your space<span>.</span></p>
          <p className={s.description}>The films you love. The series you stay up for.<br />Your next obsession is waiting.</p>
          <div className={s.categories}><span>Movies</span><i /><span>Series</span><i /><span>Anime</span></div>
        </div>
        <div className={s.heroFoot}><span className={s.line} /><span>Make tonight a good story.</span></div>
      </section>
      <section className={s.formSide} aria-labelledby="login-title">
        <div className={s.formInner}>
          <p className={s.eyebrow}><span /> The good part starts here</p>
          <h1 id="login-title">Welcome back<span>.</span></h1>
          <p className={s.formIntro}>Sign in and find your next great watch.</p>
          <form onSubmit={handleLogin} aria-busy={loading}>
            <div className={s.fieldGroup}>
              <label htmlFor="login-email">Email address</label>
              <div className={s.inputWrap}><Mail size={17} aria-hidden="true" /><input id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" required value={email} readOnly={loading} onChange={event => setEmail(event.target.value)} aria-describedby={error ? 'login-error' : undefined} /></div>
            </div>
            <div className={s.fieldGroup}>
              <label htmlFor="login-password">Password</label>
              <div className={s.inputWrap}><KeyRound size={17} aria-hidden="true" /><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required value={password} readOnly={loading} onChange={event => setPassword(event.target.value)} aria-describedby={error ? 'login-error' : undefined} /><button type="button" className={s.passwordToggle} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(show => !show)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            </div>
            {error && <p id="login-error" role="alert" className={s.error}>{error}</p>}
            <button type="submit" className={s.submit} disabled={loading}>{loading ? <><LoaderCircle size={17} className={s.spinner} /> Signing in...</> : <><span>Sign in to VANTRA</span><ArrowRight size={18} /></>}</button>
          </form>
          <div className={s.invitation}><LockKeyhole size={15} aria-hidden="true" /><p>Just for our members.<br /><span>Use the email connected to your invitation.</span></p></div>
        </div>
      </section>
    </main>
    <footer className={s.footer}><span>Your stories. Your pace.</span><span>Movies. Series. Anime.</span></footer>
  </div>
}
