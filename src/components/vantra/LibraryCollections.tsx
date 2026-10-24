'use client'
import { useEffect, useRef, useState } from 'react'
import { FolderPlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { collectionName, type LibraryCollection } from '@/lib/library-tracking'
import t from './library-tracking.module.css'
import s from './vantra.module.css'
import CollectionArrange from './CollectionArrange'
import c from './collections.module.css'
import { lockBodyScroll } from '@/lib/body-scroll-lock'

export default function LibraryCollections({ userId, collections, target, onClose, onChanged }: {
  userId: string; collections: LibraryCollection[]; target: { id: string; title: string; collection_items?: { collection_id: string }[] } | null
  onClose: () => void; onChanged: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState(new Set(target?.collection_items?.map(item => item.collection_id) || []))
  const [membershipLoading,setMembershipLoading]=useState(!!target)
  const [membershipFailed,setMembershipFailed]=useState(false)
  const [renames, setRenames] = useState<Record<string,string>>({})
  const [deleting, setDeleting] = useState<LibraryCollection | null>(null)
  const locked = useRef(false)
  const [arranging,setArranging]=useState<LibraryCollection|null>(null)
  useEffect(() => { const node=dialog.current; node?.showModal();const unlock=lockBodyScroll();return () => {node?.close();unlock()} }, [])
  useEffect(()=>{
    if(!target)return
    const controller=new AbortController()
    void createClient().from('collection_items').select('collection_id').eq('user_id',userId).eq('watchlist_id',target.id).abortSignal(controller.signal).then(result=>{
      if(controller.signal.aborted)return
      if(result.error){setMembershipFailed(true);setError('Could not load this title’s collections. Close this panel and try again.')}
      else setSelected(new Set(result.data.map(item=>item.collection_id)))
      setMembershipLoading(false)
    })
    return ()=>controller.abort()
  },[target,userId])
  async function action(work: () => Promise<void>) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(null)
    try { await work(); onChanged() } catch (err) { setError(err instanceof Error ? err.message : 'Could not update your collections.') }
    finally { locked.current = false; setBusy(false) }
  }
  async function create() {
    await action(async () => {
      const clean = collectionName(name)
      const result = await createClient().from('library_collections').insert({ user_id: userId, name: clean }).select('id').single()
      if (result.error) throw new Error(result.error.code === '23505' ? 'A collection with this name already exists.' : 'Could not create this collection.')
      setName('')
    })
  }
  async function rename(item: LibraryCollection) {
    await action(async () => {
      const clean = collectionName(renames[item.id] ?? item.name)
      const result = await createClient().from('library_collections').update({ name: clean }).eq('id',item.id).eq('user_id',userId).select('id').single()
      if (result.error) throw new Error(result.error.code === '23505' ? 'A collection with this name already exists.' : 'Could not rename this collection.')
    })
  }
  async function remove() {
    if (!deleting) return
    await action(async () => {
      const result = await createClient().from('library_collections').delete().eq('id',deleting.id).eq('user_id',userId).select('id').single()
      if (result.error) throw new Error('Could not delete this collection.')
      setDeleting(null)
    })
  }
  async function assign(item: LibraryCollection) {
    if (!target) return
    await action(async () => {
      const removing = selected.has(item.id), client = createClient()
      const result = removing ? await client.from('collection_items').delete().eq('user_id',userId).eq('collection_id',item.id).eq('watchlist_id',target.id)
        : await client.from('collection_items').upsert({ user_id:userId, collection_id:item.id, watchlist_id:target.id }, { onConflict:'watchlist_id,collection_id',ignoreDuplicates:true })
      if (result.error) throw new Error('Could not change this collection.')
      setSelected(previous => { const next=new Set(previous); if(removing)next.delete(item.id);else next.add(item.id);return next })
    })
  }
  if(arranging&&!target)return <dialog ref={dialog} className={t.dialog} aria-label={`Arrange ${arranging.name}`} onCancel={event=>{event.preventDefault();if(!busy)setArranging(null)}}><CollectionArrange userId={userId} collection={arranging} onChanged={onChanged} onBack={()=>setArranging(null)} onBusyChange={setBusy}/></dialog>
  return <dialog ref={dialog} className={t.dialog} aria-labelledby="collections-heading" onCancel={event => { if (busy) event.preventDefault(); else onClose() }}>
    <div className={t.heading}><h2 id="collections-heading">{target ? 'Save to collections' : 'Your collections'}<span className={s.accent}>.</span></h2><button aria-label="Close collections" disabled={busy} onClick={onClose}><X size={19}/></button></div>
    <p className={t.muted}>{target ? target.title : 'Private shelves for every mood. A title can belong to more than one.'}</p>
    <form className={t.create} onSubmit={event => {event.preventDefault();void create()}}><input aria-label="New collection name" className={t.input} placeholder="A new collection…" maxLength={50} value={name} onChange={event => setName(event.target.value)} /><button className={t.iconButton} aria-label="Create collection" disabled={busy||!name.trim()}><Plus size={17}/></button></form>
    {error && <p className={t.error} role="alert">{error}</p>}
    <div className={t.list}>{collections.length ? collections.map(item => target ? <label className={t.check} key={item.id}><input type="checkbox" checked={selected.has(item.id)} disabled={busy||membershipLoading||membershipFailed} onChange={() => {void assign(item)}}/>{item.name}</label> : <div className={t.row} key={item.id}><FolderPlus size={16}/><div style={{flex:1,minWidth:0}}><input aria-label={`Rename ${item.name}`} className={t.input} style={{width: '100%'}} value={renames[item.id]??item.name} maxLength={50} onChange={event => setRenames(previous=>({...previous,[item.id]:event.target.value}))}/><button type="button" className={c.arrangeLink} disabled={busy} onClick={()=>setArranging(item)}>Arrange titles &amp; choose cover</button></div><button className={t.iconButton} aria-label={`Save name for ${item.name}`} disabled={busy} onClick={()=>{void rename(item)}}><Pencil size={14}/></button><button className={t.iconButton} aria-label={`Delete ${item.name}`} disabled={busy} onClick={()=>setDeleting(item)}><Trash2 size={14}/></button></div>) : <p className={t.muted}>Create your first collection above.</p>}</div>
    {deleting && <div className={t.error} role="group" aria-label="Confirm collection removal"><p>Delete “{deleting.name}”? Titles, ratings and watched episodes stay in your library.</p><div className={t.actions}><button className={t.manage} disabled={busy} onClick={()=>setDeleting(null)}>Keep collection</button><button className={s.primary} disabled={busy} onClick={()=>{void remove()}}>Delete collection</button></div></div>}
    <div className={t.actions}><button className={s.secondary} disabled={busy} onClick={onClose}>Done</button></div>
  </dialog>
}
