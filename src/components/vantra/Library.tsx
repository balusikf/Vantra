'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, ChevronLeft, ChevronRight, History, Search, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { CATALOG_PAGE_SIZE } from '@/lib/catalog-page'
import { deleteOwnedLibraryRows, removeSavedTitle } from '@/lib/library-delete'
import { hasPrivateReview, type PrivateReview } from '@/lib/private-review'
import { PrivateReviewEditor, RemoveReviewedTitleDialog } from './PrivateReview'
import { LockKeyhole, MessageSquareText, PencilLine, Star } from 'lucide-react'
import r from './private-review.module.css'
import type { LibraryItem } from '@/types/media'
import { useAccount } from './AccountProvider'
import Avatar from './Avatar'
import Shell, { ErrorPanel } from './Shell'
import { PosterCard, PosterSkeletons } from './Primitives'
import s from './vantra.module.css'
import t from './library-tracking.module.css'
import LibraryCollections from './LibraryCollections'
import CollectionShelves from './CollectionShelves'
import { FolderPlus, Sparkles } from 'lucide-react'
import { watchStatuses, type WatchStatus, type SavedTracking, type LibraryCollection } from '@/lib/library-tracking'

type Tab = 'watchlist' | 'history'
type Kind = 'all' | 'movie' | 'tv' | 'anime'
type Entry = LibraryItem & Partial<PrivateReview> & Partial<SavedTracking> & { added_at?: string; last_watched?: string; collection_items?: { collection_id: string }[] }
const labels = { all: 'All titles', movie: 'Movies', tv: 'Series', anime: 'Anime' }

function Collection({ userId, initialTab }: { userId: string; initialTab: Tab }) {
  const { profile } = useAccount()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [kind, setKind] = useState<Kind>('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [items, setItems] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<{ watchlist: number | null; history: number | null }>({ watchlist: null, history: null })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [reviewItem, setReviewItem] = useState<Entry | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Entry | null>(null)
  const [statusFilter, setStatusFilter] = useState<WatchStatus | 'all'>('all')
  const [collectionFilter, setCollectionFilter] = useState('all')
  const [collections, setCollections] = useState<LibraryCollection[]>([])
  const [collectionsRevision, setCollectionsRevision] = useState(0)
  const [collectionsError, setCollectionsError] = useState<string | null>(null)
  const [collectionDialog, setCollectionDialog] = useState<{ target: Entry | null } | null>(null)
  const [updates, setUpdates] = useState<Record<string,{ count:number; partial:boolean }>>({})
  const [updatesFailed, setUpdatesFailed] = useState(false)
  const confirm = useRef<HTMLDialogElement>(null)
  const mutation = useRef(false)
  const section = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function loadCollections() {
      try {
        const all:LibraryCollection[]=[]
        for(let offset=0;;offset+=500) {
          const result=await createClient().rpc('collection_summaries').range(offset,offset+499).abortSignal(controller.signal)
          if(controller.signal.aborted)return
          if(result.error)throw result.error
          all.push(...result.data)
          if(result.data.length<500)break
        }
        setCollections(all);setCollectionsError(null)
        setCollectionFilter(current=>current==='all'||all.some(item=>item.id===current)?current:'all')
      }catch{if(!controller.signal.aborted)setCollectionsError('Your collections could not be loaded.')}
    }
    void loadCollections()
    return ()=>controller.abort()
  },[userId,collectionsRevision])
  const completedKey = tab==='watchlist' ? JSON.stringify(items.filter(item=>item.watch_status==='completed'&&item.media_type!=='movie').map(item=>[item.id,item.completed_at])) : '[]'
  useEffect(()=>{
    const controller=new AbortController()
    const entries=JSON.parse(completedKey) as [string,string][]
    void Promise.resolve().then(()=>{
      if(controller.signal.aborted)return
      setUpdates({});setUpdatesFailed(false)
      if(!entries.length)return
      return fetch(`/api/library/updates?ids=${entries.map(item=>item[0]).join(',')}`,{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error('Updates unavailable')
      const data=await response.json()
      if(!controller.signal.aborted)setUpdates(data.updates)
      })
    }).catch(()=>{if(!controller.signal.aborted)setUpdatesFailed(true)})
    return ()=>controller.abort()
  },[userId,completedKey])

  useEffect(() => {
    const timer = setTimeout(() => { if (search.trim() !== query) { setLoading(true); setPage(1); setQuery(search.trim()) } }, 250)
    return () => clearTimeout(timer)
  }, [search, query])

  useEffect(() => {
    const controller = new AbortController()
    async function count() {
      const supabase = createClient()
      // The active list query already returns its total. Count only the other tab.
      const inactive = initialTab === 'watchlist' ? 'history' : 'watchlist'
      const result = await supabase.from(inactive === 'watchlist' ? 'watchlist' : 'watch_history')
        .select('id', { count: 'exact', head: true }).eq('user_id', userId).abortSignal(controller.signal)
      if (!controller.signal.aborted) setCounts(current => ({ ...current, [inactive]: result.error ? null : result.count }))
    }
    void count().catch(() => {})
    return () => controller.abort()
  }, [userId, initialTab])

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const dateColumn = tab === 'watchlist' ? 'added_at' : 'last_watched'
        if(tab==='watchlist'&&collectionFilter!=='all') {
          let request=createClient().from('collection_items').select('position,watchlist!inner(id,user_id,tmdb_id,media_type,title,poster_path,added_at,personal_rating,personal_note,watch_status,completed_at,collection_items(collection_id))',{count:'exact'}).eq('user_id',userId).eq('collection_id',collectionFilter).eq('watchlist.user_id',userId)
          if(statusFilter!=='all')request=request.eq('watchlist.watch_status',statusFilter)
          if(kind!=='all')request=request.eq('watchlist.media_type',kind)
          if(query)request=request.ilike('watchlist.title',`%${query.replace(/[\\%_]/g,'\\$&')}%`)
          const result=await request.order('position').order('watchlist_id').range((page-1)*CATALOG_PAGE_SIZE,page*CATALOG_PAGE_SIZE-1).abortSignal(controller.signal)
          if(controller.signal.aborted)return
          if(result.error)throw result.error
          if(page>1&&!result.data?.length&&result.count){setPage(Math.max(1,Math.ceil(result.count/CATALOG_PAGE_SIZE)));return}
          setItems((result.data||[]).map(row=>row.watchlist) as unknown as Entry[]);setTotal(result.count||0);setError(null);return
        }
        let request = createClient().from(tab === 'watchlist' ? 'watchlist' : 'watch_history')
          .select(`id, user_id, tmdb_id, media_type, title, poster_path, ${dateColumn}${tab === 'history' ? ', season, episode' : `, personal_rating, personal_note, watch_status, completed_at, collection_items${collectionFilter!=='all'?'!inner':''}(collection_id)`}`, { count: 'exact' }).eq('user_id', userId)
        if (tab==='watchlist' && statusFilter!=='all') request=request.eq('watch_status',statusFilter)
        if (tab==='watchlist' && collectionFilter!=='all') request=request.eq('collection_items.collection_id',collectionFilter)
        if (kind !== 'all') request = request.eq('media_type', kind)
        if (query) request = request.ilike('title', `%${query.replace(/[\\%_]/g, '\\$&')}%`)
        if (sort === 'rating' && tab === 'watchlist') request = request.order('personal_rating', { ascending: false, nullsFirst: false }).order(dateColumn, { ascending: false })
        else request = request.order(sort === 'title' ? 'title' : dateColumn, { ascending: sort === 'title' })
        request = request.order('id', { ascending: false })
        const { data, count, error } = await request.range((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE - 1).abortSignal(controller.signal)
        if (controller.signal.aborted) return
        if (error) throw error
        if (page > 1 && !data?.length && count) { setPage(Math.max(1, Math.ceil(count / CATALOG_PAGE_SIZE))); return }
        setItems((data || []) as unknown as Entry[]); setTotal(count || 0); setError(null)
        if (kind === 'all' && !query && (tab==='history'||(statusFilter==='all'&&collectionFilter==='all'))) setCounts(current => ({ ...current, [tab]: count ?? 0 }))
      } catch { if (!controller.signal.aborted) { setItems([]); setTotal(0); setError('Your collection could not be loaded. Please try again.') } }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [userId, tab, kind, query, page, sort, revision, statusFilter, collectionFilter])

  function reset() { setPage(1); setLoading(true); setError(null); setNotice(null) }
  function switchTab(next: Tab) { if (next === tab) return; reset(); setTab(next); setKind('all'); setSort('recent'); setSearch(''); setQuery(''); setStatusFilter('all'); setCollectionFilter('all') }
  function filter(next: Kind) { if (next === kind) return; reset(); setKind(next) }
  function paginate(next: number) { setPage(next); setLoading(true); setError(null); section.current?.scrollIntoView({ behavior: 'instant', block: 'start' }) }

  async function remove(item: Entry, reviewConfirmed = false) {
    if (mutation.current) return
    mutation.current = true; setBusy(item.id); setError(null); setNotice(null)
    try {
      const result = await removeSavedTitle(createClient(), userId, { id: item.id }, reviewConfirmed)
      if (result.needsConfirmation) { setRemoveTarget(item); return }
      setRemoveTarget(null)
      setCounts(current => ({ ...current, watchlist: current.watchlist === null ? null : Math.max(0, current.watchlist - 1) }))
      setNotice(`Removed ${item.title} from your watchlist.`); setLoading(true); setRevision(value => value + 1)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not remove this title.') }
    finally { mutation.current = false; setBusy(null) }
  }
  async function clearHistory() {
    if (mutation.current) return
    mutation.current = true; setBusy('history'); setError(null); setNotice(null)
    try {
      await deleteOwnedLibraryRows(createClient(), 'watch_history', userId)
      setCounts(current => ({ ...current, history: 0 })); setPage(1); setLoading(true); setRevision(value => value + 1); setNotice('Your watch history has been cleared.'); confirm.current?.close()
    } catch { setError('Could not clear your watch history. Please try again.'); confirm.current?.close() }
    finally { mutation.current = false; setBusy(null) }
  }
  async function changeStatus(item: Entry, status: WatchStatus) {
    if(mutation.current)return
    mutation.current=true;setBusy(item.id);setError(null)
    try{
      const result=await createClient().from('watchlist').update({watch_status:status}).eq('id',item.id).eq('user_id',userId).select('watch_status,completed_at').single()
      if(result.error)throw result.error
      setItems(previous=>previous.map(row=>row.id===item.id?{...row,...result.data}:row));setNotice(`${item.title}: ${watchStatuses[status]}.`)
      if(statusFilter!=='all'){setLoading(true);setRevision(value=>value+1)}
    }catch{setError('Could not update the watching status. Please try again.')}
    finally{mutation.current=false;setBusy(null)}
  }
  function submit(event: FormEvent) { event.preventDefault(); reset(); setQuery(search.trim()); setRevision(value => value + 1) }
  const searching = loading || search.trim() !== query
  const pages = Math.ceil(total / CATALOG_PAGE_SIZE)
  const firstName = profile?.display_name?.trim().split(/\s+/)[0]

  return <>
    <section className={`${s.personalHero} ${s.libraryHero}`}><div><p className={s.eyebrow}>CURATED BY YOU</p><h1>Your stories<span>.</span><br />Your library<span>.</span></h1><p>{firstName ? `${firstName}, your` : 'Your'} next great night starts right here.</p></div><div className={s.libraryHeroAside}><Bookmark size={68} strokeWidth={.8} /><span>THE ONES YOU KEEP<br />COMING BACK TO.</span></div></section>
    <div className={s.personalContent}>
      <div className={s.libraryHeading}><div className={s.collectionTabs} aria-label="Library collection">{([{ value: 'watchlist', label: 'Watchlist', icon: Bookmark }, { value: 'history', label: 'Watch history', icon: History }] as const).map(item => <button key={item.value} aria-pressed={tab === item.value} onClick={() => switchTab(item.value)}><item.icon size={18} /><span>{item.label}</span><small>{counts[item.value] ?? '—'}</small>{tab === item.value && <motion.i layoutId="library-tab" transition={{ type: 'spring', stiffness: 430, damping: 38 }} />}</button>)}</div><Link href="/profile" className={s.libraryProfile}><Avatar /><span>Your profile</span><ArrowUpRight size={15} /></Link></div>
      {tab==='watchlist'&&<CollectionShelves collections={collections} selected={collectionFilter} onSelect={value=>{reset();setCollectionFilter(value)}}/>}
      <div className={s.libraryControls} ref={section}><div className={s.filters} aria-label="Filter library">{(Object.keys(labels) as Kind[]).map(value => <button key={value} aria-pressed={kind === value} className={kind === value ? s.selectedFilter : ''} onClick={() => filter(value)}>{labels[value]}</button>)}</div><div className={s.libraryTools}><form className={s.catalogSearch} onSubmit={submit}><Search size={17} /><input aria-label="Search your library" placeholder="Search your library…" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} />{search && <button aria-label="Clear library search" type="button" onClick={() => { setSearch(''); if (query) { reset(); setQuery(''); setStatusFilter('all'); setCollectionFilter('all') } }}><X size={15} /></button>}</form><label className={s.sortLabel}><span className="sr-only">Sort library</span><select disabled={tab==='watchlist'&&collectionFilter!=='all'} value={tab==='watchlist'&&collectionFilter!=='all'?'collection':sort} onChange={event => { reset(); setSort(event.target.value) }}><option value="collection" hidden>Collection order</option><option value="recent">{tab === 'history' ? 'Recently opened' : 'Recently added'}</option><option value="title">Title A–Z</option>{tab === 'watchlist' && <option value="rating">My highest rated</option>}</select></label></div></div>
      {tab==='watchlist'&&<div className={t.bar}>
        <label>Status<select className={t.select} aria-label="Filter watching status" value={statusFilter} onChange={event=>{reset();setStatusFilter(event.target.value as WatchStatus|'all')}}><option value="all">All statuses</option>{Object.entries(watchStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Collection<select className={t.select} aria-label="Filter collection" value={collectionFilter} onChange={event=>{reset();setCollectionFilter(event.target.value)}}><option value="all">All collections</option>{collections.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button className={t.manage} onClick={()=>setCollectionDialog({target:null})}><FolderPlus size={14}/>Manage collections</button>
        {collectionsError&&<span className={t.error}>{collectionsError} <button onClick={()=>setCollectionsRevision(value=>value+1)}>Try again</button></span>}
      </div>}
      <div className={s.collectionLabel}><span>{tab === 'watchlist' ? 'SAVED FOR A GOOD NIGHT' : 'RECENTLY OPENED STORIES'}</span><span>{searching ? 'Finding your stories…' : `${total} ${total === 1 ? 'title' : 'titles'}`}</span></div>
      {updatesFailed&&tab==='watchlist'&&<p className={t.muted}>New episode checks are temporarily unavailable. Your saved titles and watched marks are safe.</p>}
      {notice && <p role="status" className={s.libraryNotice}>{notice}</p>}
      {error && <p role="alert" className={s.inlineError}>{error} <button onClick={() => { setLoading(true); setRevision(value => value + 1) }}>Try again <ArrowRight size={13} /></button></p>}
      {searching ? <PosterSkeletons count={18} /> : error && !items.length ? null : !items.length ? <div className={s.libraryEmpty}><span className={s.searchOrb}>{query ? <Search size={29} /> : tab === 'watchlist' ? <Bookmark size={29} strokeWidth={1.3} /> : <History size={29} strokeWidth={1.3} />}</span><p className={s.eyebrow}>{query || kind !== 'all' || (tab==='watchlist'&&(statusFilter!=='all'||collectionFilter!=='all')) ? 'A DIFFERENT STORY, PERHAPS?' : 'MAKE ROOM FOR GREAT STORIES'}</p><h2>{query || kind !== 'all' || (tab==='watchlist'&&(statusFilter!=='all'||collectionFilter!=='all')) ? 'No matching titles.' : tab === 'watchlist' ? 'Your collection starts with one story.' : 'The story starts when you press play.'}</h2><p>{query || kind !== 'all' || (tab==='watchlist'&&(statusFilter!=='all'||collectionFilter!=='all')) ? 'Try another title or explore the rest of your library.' : tab === 'watchlist' ? 'Save movies, series and anime as you explore. They’ll be waiting right here.' : 'Titles you open in the player will appear here for you to revisit.'}</p><Link href="/browse" className={s.primary}>Discover something great <ArrowUpRight size={16} /></Link></div> : <div className={`${s.posterGrid} ${s.libraryGrid}`} key={`${tab}:${kind}:${query}:${sort}:${page}`}>
        {items.map(item => {
          const date = item.added_at || item.last_watched
          return <article className={s.libraryEntry} key={item.id}><PosterCard item={{ id: item.id, href: `/${item.media_type}/${item.tmdb_id}`, title: item.title, poster: item.poster_path ? item.poster_path.startsWith('https://') ? item.poster_path : `https://image.tmdb.org/t/p/w342${item.poster_path}` : null, year: '', kind: item.media_type === 'tv' ? 'Series' : item.media_type === 'anime' ? 'Anime' : 'Movie', rating: null }} />{tab === 'watchlist' && <button className={s.removeSaved} aria-label={`Remove ${item.title} from watchlist`} disabled={busy !== null} onClick={() => { void remove(item) }}><Trash2 size={15} /></button>}{tab==='watchlist'&&<div>
            <div className={t.tools}><select className={t.select} aria-label={`Watching status for ${item.title}`} value={item.watch_status||'planned'} disabled={busy!==null} onChange={event=>{void changeStatus(item,event.target.value as WatchStatus)}}>{Object.entries(watchStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className={t.iconButton} aria-label={`Collections for ${item.title}`} title="Add to collections" disabled={busy!==null} onClick={()=>setCollectionDialog({target:item})}><FolderPlus size={14}/></button></div>
            {updates[item.id]?.count>0&&<Link href={`/${item.media_type}/${item.tmdb_id}#episodes`} className={t.badge}><Sparkles size={12}/>{updates[item.id].partial?'New episodes':`${updates[item.id].count} new ${updates[item.id].count===1?'episode':'episodes'}`}</Link>}
            {updates[item.id]?.partial&&!updates[item.id]?.count&&<span className={t.muted}>Release check incomplete · try again later</span>}
          </div>}{tab === 'watchlist' && <div className={r.reviewCard}>
            <button className={r.reviewTrigger} onClick={() => setReviewItem(item)} aria-label={`${hasPrivateReview(item) ? 'Edit' : 'Add'} your private review for ${item.title}`}>
              <span className={r.reviewCaption}><LockKeyhole size={10} /> YOUR RATING</span><span className={r.reviewScore}>{item.personal_rating != null ? <><Star size={14} fill="currentColor" /><strong>{item.personal_rating}<small>/10</small></strong></> : <><Star size={14} /><span>Rate this title</span></>}<PencilLine size={12} className={r.editIcon} /></span>
              {item.personal_note?.trim() ? <span className={r.notePreview}>{item.personal_note}</span> : <span className={r.addNote}><MessageSquareText size={12} />{item.personal_rating != null ? 'Add your thoughts' : 'A few words, just for you'}</span>}
            </button>
          </div>}<p className={s.libraryEntryNote}>{tab === 'history' && item.media_type !== 'movie' && item.episode ? `${item.media_type === 'anime' ? 'Episode' : `S${String(item.season || 1).padStart(2, '0')} · E`}${String(item.episode).padStart(2, '0')} · ` : ''}{date ? `${tab === 'watchlist' ? 'Saved' : 'Opened'} ${new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</p></article>
        })}
      </div>}
      {pages > 1 && <div className={s.libraryPagination}><button className={s.secondary} disabled={loading || page <= 1} onClick={() => paginate(page - 1)}><ChevronLeft size={16} /> Previous</button><span>Page {page} of {pages}</span><button className={s.secondary} disabled={loading || page >= pages} onClick={() => paginate(page + 1)}>Next <ChevronRight size={16} /></button></div>}
      <div className={s.libraryBottom}><Link href="/home"><ArrowLeft size={14} /> Back to discovering</Link>{tab === 'history' && Boolean(counts.history) && <button onClick={() => confirm.current?.showModal()} disabled={busy !== null}><Trash2 size={14} /> Clear watch history</button>}</div>
    </div>
    {collectionDialog&&<LibraryCollections key={collectionDialog.target?.id||'manage'} userId={userId} collections={collections} target={collectionDialog.target} onClose={()=>setCollectionDialog(null)} onChanged={()=>{setPage(1);setCollectionsRevision(value=>value+1);setRevision(value=>value+1)}}/>}
    {reviewItem && <PrivateReviewEditor key={reviewItem.id} userId={userId} item={reviewItem} onClose={() => setReviewItem(null)} onSaved={review => { setItems(current => current.map(item => item.id === reviewItem.id ? { ...item, ...review } : item)); if (sort === 'rating') { setLoading(true); setRevision(value => value + 1) } setNotice(`Your private review for ${reviewItem.title} has been saved.`) }} />}
    {removeTarget && <RemoveReviewedTitleDialog title={removeTarget.title} busy={busy !== null} error={error} onCancel={() => setRemoveTarget(null)} onConfirm={() => { void remove(removeTarget, true) }} />}
    <dialog ref={confirm} className={`${s.confirmDialog} ${s.chrome}`} aria-labelledby="clear-history-heading" onCancel={event => { if (busy === 'history') event.preventDefault() }}><History size={30} strokeWidth={1.3} /><h2 id="clear-history-heading">Start with a clean slate?</h2><p>This removes all your watch history. Your saved watchlist stays in your library. This can’t be undone.</p><div><button autoFocus className={s.secondary} disabled={busy === 'history'} onClick={() => confirm.current?.close()}>Keep my history</button><button className={s.primary} disabled={busy === 'history'} onClick={() => { void clearHistory() }}>{busy === 'history' ? 'Clearing…' : 'Clear history'}</button></div></dialog>
  </>
}

export default function Library({ initialTab }: { initialTab: Tab }) {
  const { user, loading, error, refresh } = useAccount()
  return <Shell>{loading ? <div className={s.libraryLoading}><p className={s.eyebrow}>YOUR COLLECTION</p><h1>Opening your library<span>…</span></h1><PosterSkeletons count={18} /></div> : user ? <Collection key={user.id} userId={user.id} initialTab={initialTab} /> : <div className={s.detailError}><ErrorPanel title="Your library is taking a break." message={error || 'Please reload to open your account.'} retry={() => { void refresh() }} /></div>}</Shell>
}
