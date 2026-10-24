'use client'

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, BarChart3, Bookmark, Camera, Check, History, LogOut, ShieldCheck, Gauge, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { ownedAvatarPath, persistAvatar, prepareAvatar } from '@/lib/avatar'
import { useAccount } from '@/components/vantra/AccountProvider'
import Avatar from '@/components/vantra/Avatar'
import Shell, { ErrorPanel } from '@/components/vantra/Shell'
import s from '@/components/vantra/vantra.module.css'

function NameForm({ name, save }: { name: string; save: (name: string) => Promise<boolean> }) {
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !value.trim() || value.trim().length > 60) return
    setBusy(true); setSaved(false)
    try { if (await save(value.trim())) setSaved(true) } finally { setBusy(false) }
  }
  return <form onSubmit={submit} className={s.accountForm}><label htmlFor="display-name">Display name</label><p>This is how you appear around Vantra.</p><div className={s.nameField}><UserRound size={18} /><input id="display-name" name="display_name" value={value} onChange={event => { setValue(event.target.value); setSaved(false) }} autoComplete="nickname" required maxLength={60} /></div><div className={s.formFoot}><span role="status">{saved ? <><Check size={14} /> Changes saved</> : `${value.length}/60 characters`}</span><button className={s.primary} disabled={busy || !value.trim() || value.trim() === name.trim()}>{busy ? 'Saving…' : 'Save changes'}<ArrowRight size={15} /></button></div></form>
}

export default function ProfilePage({ canViewUsage = false }: { canViewUsage?: boolean }) {
  const { user, profile, loading, error: accountError, refresh, updateProfile } = useAccount()
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const lock = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function saveName(displayName: string) {
    if (!user || !profile) return false
    setError(null)
    try {
      const { data, error } = await createClient().from('profiles').update({ display_name: displayName }).eq('id', user.id).select('id').single()
      if (error || !data) throw new Error('Could not save your display name. Please try again.')
      updateProfile({ id: user.id, display_name: displayName }); setNotice('Display name updated.')
      return true
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your name.'); return false }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !user || !profile || lock.current) return
    lock.current = true; setAvatarBusy(true); setError(null); setNotice(null)
    const supabase = createClient()
    try {
      const image = await prepareAvatar(file)
      const previous = profile.avatar_url ? ownedAvatarPath(profile.avatar_url, user.id, process.env.NEXT_PUBLIC_SUPABASE_URL!) : null
      const filePath = `${user.id}/${crypto.randomUUID()}.webp`
      const publicUrl = (path: string) => supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      const result = await persistAvatar({
        previous,
        upload: async () => {
          const { error } = await supabase.storage.from('avatars').upload(filePath, image, { upsert: false, contentType: 'image/webp', cacheControl: '31536000' })
          if (error) throw error
          return filePath
        },
        saveProfile: async path => {
          const { data, error } = await supabase.from('profiles').update({ avatar_url: publicUrl(path) }).eq('id', user.id).select('id').single()
          if (error || !data) throw new Error('Could not save your new avatar.')
        },
        remove: async path => { const { error } = await supabase.storage.from('avatars').remove([path]); if (error) throw error },
      })
      updateProfile({ id: user.id, avatar_url: publicUrl(result.uploaded) })
      setNotice('Profile photo updated everywhere.')
      if (result.cleanupFailed) setError('Your new photo is saved. The previous file could not be cleaned up.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not upload your photo. Please try again.') }
    finally { lock.current = false; setAvatarBusy(false); if (fileInput.current) fileInput.current.value = '' }
  }

  async function removeAvatar() {
    if (!user || !profile?.avatar_url || lock.current) return
    lock.current = true; setAvatarBusy(true); setError(null); setNotice(null)
    const supabase = createClient()
    try {
      const previous = ownedAvatarPath(profile.avatar_url, user.id, process.env.NEXT_PUBLIC_SUPABASE_URL!)
      const { data, error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id).select('id').single()
      if (error || !data) throw new Error('Could not remove your photo. Please try again.')
      updateProfile({ id: user.id, avatar_url: null })
      setNotice('Profile photo removed.')
      if (previous) {
        const { error } = await supabase.storage.from('avatars').remove([previous])
        if (error) setError('Your photo was removed from your profile. The old file could not be cleaned up.')
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not remove your photo.') }
    finally { lock.current = false; setAvatarBusy(false) }
  }
  async function signOut() {
    if (signingOut) return
    setSigningOut(true); setError(null)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      router.replace('/login'); router.refresh()
    } catch { setError('Could not sign out. Please try again.'); setSigningOut(false) }
  }
  const name = profile?.display_name || 'Your profile'
  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null

  return <Shell><section className={s.personalHero}><div><p className={s.eyebrow}>YOUR SPACE, YOUR STORIES</p><h1>Make it yours<span>.</span></h1><p>A little more you. A little more Vantra.</p></div><span className={s.personalHeroMark} aria-hidden="true">VΛ</span></section>
    <div className={s.personalContent}>
      {loading ? <div className={s.accountSkeleton} aria-busy="true" aria-label="Loading your profile"><div /><div /></div> : accountError || !profile || !user ? <ErrorPanel title="Your profile is taking a break." message={accountError || 'Please reload to load your account.'} retry={() => { void refresh() }} /> : <div className={s.accountLayout}>
        <aside className={s.accountSidebar}><div className={s.identityCard}><Avatar large /><h2>{name}</h2>{joined && <p>Member since {joined}</p>}<span className={s.memberBadge}><ShieldCheck size={13} /> Your private space</span></div><div className={s.accountNav}>{canViewUsage && <Link href="/profile/usage"><Gauge size={17} /> Supabase usage<ArrowUpRight size={14} /></Link>}<span className={s.accountNavActive}><UserRound size={17} /> Profile & account</span><Link href="/profile/stats"><BarChart3 size={17} /> Your statistics<ArrowUpRight size={14} /></Link><Link href="/library"><Bookmark size={17} /> My library<ArrowUpRight size={14} /></Link><Link href="/library?tab=history"><History size={17} /> Watch history<ArrowUpRight size={14} /></Link></div><button className={s.signOut} onClick={signOut} disabled={signingOut}><LogOut size={16} />{signingOut ? 'Signing out…' : 'Sign out'}</button></aside>
        <div className={s.accountPanels}>
          <div className={s.accountPageHeading}><div><p className={s.eyebrow}>THE DETAILS THAT MAKE YOU, YOU</p><h2>Profile & account<span>.</span></h2></div><span>01 / PERSONAL</span></div>
          {error && <p role="alert" className={s.inlineError}>{error}</p>}{notice && <p role="status" className={s.successNotice}><Check size={15} />{notice}</p>}
          <section className={s.accountPanel}><div className={s.panelHeading}><div><h3>Profile photo</h3><p>A familiar face, wherever the story takes you.</p></div><Camera size={21} /></div><div className={s.photoSettings}><Avatar large /><div><div className={s.photoActions}><button className={s.secondary} disabled={avatarBusy} onClick={() => fileInput.current?.click()}><Camera size={15} />{avatarBusy ? 'Updating photo…' : 'Change photo'}</button>{profile.avatar_url && <button className={s.textButton} disabled={avatarBusy} onClick={removeAvatar}>Remove photo</button>}</div><p>JPEG, PNG or WebP · up to 5 MB<br />Optimized automatically for your profile.</p><input hidden ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile photo" onChange={uploadAvatar} /></div></div></section>
          <section className={s.accountPanel}><div className={s.panelHeading}><div><h3>Personal details</h3><p>Your name. Your place in the credits.</p></div><UserRound size={21} /></div><NameForm key={profile.display_name} name={profile.display_name || ''} save={saveName} /><div className={s.emailField}><label htmlFor="account-email">Email address</label><input id="account-email" value={user.email || ''} readOnly aria-describedby="email-note" /><p id="email-note"><ShieldCheck size={13} /> Used to sign in to your account.</p></div></section>
          <Link href="/profile/stats" className={s.accountLibraryLink}><span className={s.accountLibraryIcon}><BarChart3 size={25} strokeWidth={1.3} /></span><div><p className={s.eyebrow}>YOUR VIEWING JOURNAL</p><h3>Your stories, in numbers.</h3><p>Explore your activity, private ratings and finished stories.</p></div><ArrowUpRight size={23} /></Link>
          <Link href="/library" className={s.accountLibraryLink}><span className={s.accountLibraryIcon}><Bookmark size={25} strokeWidth={1.3} /></span><div><p className={s.eyebrow}>READY WHEN YOU ARE</p><h3>Your next great night is saved.</h3><p>Pick up your watchlist and revisit recent stories.</p></div><ArrowUpRight size={23} /></Link>
        </div>
      </div>}
    </div>
  </Shell>
}
