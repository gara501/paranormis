import {useEffect, useMemo, useRef, useState} from 'react'
import {sanityClient} from '../lib/sanity'
import SiteHeader from './SiteHeader'
import ConnectionBoard from './ConnectionBoard'
import './CreatureArchive.css'
import '../styles/paranormis.css'

interface Creature {
  _id: string
  name: string
  regionalNames?: string[]
  physicalDescription?: string
  distinctiveTraits?: string[]
  folkloreOrigin?: string
  threatLevel?: 'harmless' | 'caution' | 'dangerous' | 'unknown'
  imageUrl?: string
  regions?: {name: string; country?: string}[]
}

export interface FieldSighting {
  _id: string
  creatureId: string
  date?: string
  credibilityIndex?: number | null
  status?: string
  observedTraits?: string[]
  freeformDescription?: string
  location?: {lat: number; lng: number}
  region?: {name: string; country?: string} | null
  corroboratedBy?: {_ref: string}[]
}

const CREATURE_QUERY = `*[_type == "creature"] | order(name asc) {
  _id, name, regionalNames, physicalDescription, distinctiveTraits, folkloreOrigin, threatLevel,
  "imageUrl": archiveIllustration.asset->url,
  "regions": regions[]->{name, country}
}`

const SIGHTINGS_QUERY = `*[_type == "sighting" && defined(creature._ref)] | order(date desc) {
  _id, "creatureId": creature._ref, date, credibilityIndex, status,
  observedTraits, freeformDescription, location, corroboratedBy[]{_ref},
  "region": region->{name, country}
}`

const THREATS: Record<string, {label: string; className: string; description: string}> = {
  harmless: {label: 'RIESGO BAJO', className: 'low', description: 'No hay comportamiento hostil documentado'},
  caution: {label: 'PRECAUCIÓN', className: 'caution', description: 'Aproximarse solo con apoyo del equipo'},
  dangerous: {label: 'AMENAZA ALTA', className: 'high', description: 'Se desaconseja el contacto directo'},
  unknown: {label: 'SIN CLASIFICAR', className: 'unknown', description: 'Evidencia insuficiente para evaluar'},
}

const FILTERS = [
  {value: 'all', label: 'Todas'},
  {value: 'dangerous', label: 'Amenaza alta'},
  {value: 'caution', label: 'Precaución'},
  {value: 'harmless', label: 'Riesgo bajo'},
  {value: 'unknown', label: 'Desconocido'},
]

function getHashId() {
  try { return decodeURIComponent(window.location.hash.slice(1)) } catch { return '' }
}

function formatSightingDate(value?: string) {
  if (!value) return 'Fecha no registrada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Fecha no registrada' : new Intl.DateTimeFormat('es-ES', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(date)
}

function normalizeTrait(value: string) {
  return value.trim().toLocaleLowerCase()
}

export default function CreatureArchive() {
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [sightings, setSightings] = useState<FieldSighting[]>([])
  const [sightingsStatus, setSightingsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedSightingId, setSelectedSightingId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [musicOn, setMusicOn] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setStatus('loading')
      setSightingsStatus('loading')
      const [creatureResult, sightingResult] = await Promise.allSettled([
        sanityClient.fetch<Creature[]>(CREATURE_QUERY),
        sanityClient.fetch<FieldSighting[]>(SIGHTINGS_QUERY),
      ])
      if (!active) return
      if (creatureResult.status === 'fulfilled') {
        setCreatures(creatureResult.value)
        setSelectedId(creatureResult.value.find((creature) => creature._id === getHashId())?._id ?? creatureResult.value[0]?._id ?? '')
        setStatus('ready')
      } else {
        console.error('Unable to load the entity archive:', creatureResult.reason)
        setStatus('error')
      }
      if (sightingResult.status === 'fulfilled') {
        setSightings(sightingResult.value)
        setSightingsStatus('ready')
      } else {
        console.error('Unable to load field reports:', sightingResult.reason)
        setSightingsStatus('error')
      }
    }
    load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    let requestVersion = 0
    const subscription = sanityClient.listen('*[_type == "sighting"]', {}, {tag: 'bestiary-archive-live'}).subscribe({
      next: async () => {
        const version = ++requestVersion
        try {
          const latest = await sanityClient.fetch<FieldSighting[]>(SIGHTINGS_QUERY)
          if (active && version === requestVersion) {
            setSightings(latest)
            setSightingsStatus('ready')
          }
        } catch (error) {
          console.error('Unable to refresh field reports:', error)
        }
      },
      error: (error) => console.error('Live field report feed error:', error),
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      const id = getHashId()
      if (creatures.some((creature) => creature._id === id)) setSelectedId(id)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [creatures])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return creatures.filter((creature) => {
      const matchesFilter = filter === 'all' || (creature.threatLevel ?? 'unknown') === filter
      const matchesQuery = !term || [creature.name, ...(creature.regionalNames ?? []), ...(creature.regions?.map((region) => region.name) ?? [])]
        .some((value) => value.toLocaleLowerCase().includes(term))
      return matchesFilter && matchesQuery
    })
  }, [creatures, filter, query])

  const selected = creatures.find((creature) => creature._id === selectedId) ?? creatures[0]
  const threat = THREATS[selected?.threatLevel ?? 'unknown'] ?? THREATS.unknown
  const selectedIndex = creatures.findIndex((creature) => creature._id === selected?._id)
  const creatureSightings = useMemo(() => sightings.filter((sighting) => sighting.creatureId === selected?._id), [sightings, selected?._id])
  const selectedSighting = creatureSightings.find((sighting) => sighting._id === selectedSightingId) ?? creatureSightings[0]
  const canonicalTraits = selected?.distinctiveTraits ?? []
  const observedTraits = selectedSighting?.observedTraits ?? []
  const observedSet = new Set(observedTraits.map(normalizeTrait))
  const canonicalSet = new Set(canonicalTraits.map(normalizeTrait))
  const matchedCount = canonicalTraits.filter((trait) => observedSet.has(normalizeTrait(trait))).length
  const unlistedObservations = observedTraits.filter((trait) => !canonicalSet.has(normalizeTrait(trait)))

  useEffect(() => {
    if (visible.length && !visible.some((creature) => creature._id === selectedId)) {
      const id = visible[0]._id
      setSelectedId(id)
      history.replaceState(null, '', `#${encodeURIComponent(id)}`)
    }
  }, [visible, selectedId])

  function chooseCreature(id: string) {
    setSelectedId(id)
    history.replaceState(null, '', `#${encodeURIComponent(id)}`)
    document.querySelector('.archive__profile')?.scrollTo({top: 0, behavior: 'smooth'})
  }

  function stepCreature(direction: number) {
    if (!creatures.length) return
    chooseCreature(creatures[(selectedIndex + direction + creatures.length) % creatures.length]._id)
  }

  function openConnectedReport(id: string) {
    const report = sightings.find((item) => item._id === id)
    if (!report) return
    if (report.creatureId !== selected?._id) chooseCreature(report.creatureId)
    setSelectedSightingId(id)
    document.querySelector('.archive__investigation')?.scrollIntoView({behavior: 'smooth', block: 'start'})
  }

  async function toggleMusic() {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      setMusicOn(false)
      return
    }
    try {
      audio.volume = 0.35
      await audio.play()
      setMusicOn(true)
    } catch {
      setMusicOn(false)
    }
  }

  return (
    <main className="archive">
      <div className="archive__grain" aria-hidden="true" />
      <SiteHeader active="bestiary" />

      <section className="archive__intro" aria-label="Introducción al archivo">
        <div className="archive__intro-copy">
          <p className="archive__eyebrow"><span className="archive__live-dot" /> ARCHIVO VIVO <span className="archive__eyebrow-rule" /> VOL. 01</p>
          <h1>Lo desconocido tiene nombre.</h1>
          <p className="archive__lede">Cada leyenda deja un rastro. Explora los expedientes de las entidades reportadas en todo el mundo.</p>
        </div>
        <div className="archive__intro-aside" aria-hidden="true"><span>●</span><p>DOCUMENTOS<br />RESTRINGIDOS</p><b>001—{String(creatures.length).padStart(3, '0')}</b></div>
      </section>

      <div className="archive__workbench">
        <aside className="archive__index" aria-label="Índice de entidades">
          <div className="archive__index-heading"><div><span>01 / ÍNDICE</span><h2>Expedientes</h2></div><span className="archive__count">{String(visible.length).padStart(2, '0')} / {String(creatures.length).padStart(2, '0')}</span></div>
          <label className="archive__search"><span aria-hidden="true">⌕</span><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar archivo..." aria-label="Buscar entidades" /><kbd>Ctrl K</kbd></label>
          <div className="archive__filters" role="group" aria-label="Filtrar por nivel de amenaza">
            {FILTERS.map((item) => <button key={item.value} type="button" className={filter === item.value ? 'is-active' : ''} onClick={() => setFilter(item.value)} aria-pressed={filter === item.value}>{item.label}</button>)}
          </div>
          <div className="archive__list">
            {status === 'loading' && <p className="archive__message">Descifrando expedientes…</p>}
            {status === 'error' && <div className="archive__message">Conexión con el archivo perdida.<button type="button" onClick={() => window.location.reload()}>Reintentar conexión ↗</button></div>}
            {status === 'ready' && visible.length === 0 && <p className="archive__message">No hay registros para esa búsqueda.</p>}
            {visible.map((creature) => <button className={`archive__list-item ${selected?._id === creature._id ? 'is-selected' : ''}`} key={creature._id} type="button" onClick={() => chooseCreature(creature._id)} aria-current={selected?._id === creature._id ? 'true' : undefined} aria-label={`Abrir perfil de ${creature.name}`}>
              <span className="archive__list-image">{creature.imageUrl ? <img src={`${creature.imageUrl}?w=160&h=160&fit=crop&auto=format`} alt="" loading="lazy" /> : '✦'}</span>
              <span className="archive__list-copy"><strong>{creature.name}</strong><small>{creature.regions?.[0]?.name ?? 'Origen sin confirmar'}</small></span>
              <span className={`archive__list-level archive__list-level--${THREATS[creature.threatLevel ?? 'unknown']?.className ?? 'unknown'}`} title={THREATS[creature.threatLevel ?? 'unknown']?.label} />
              <span className="archive__list-arrow" aria-hidden="true">↗</span>
            </button>)}
          </div>
          <div className="archive__index-footer"><span>✳</span> Información de campo. Registros sujetos a revisión.</div>
        </aside>

        <article className="archive__profile" aria-live="polite">
          {selected ? <>
            <div className="archive__profile-top"><span>02 / PERFIL DE ENTIDAD</span><span>EXPEDIENTE {String(selectedIndex + 1).padStart(3, '0')} — {String(creatures.length).padStart(3, '0')}</span></div>
            <div className="archive__hero">
              <div className="archive__art">
                <span className="archive__art-grid" aria-hidden="true" />
                <span className="archive__art-cross archive__art-cross--one" aria-hidden="true">+</span><span className="archive__art-cross archive__art-cross--two" aria-hidden="true">+</span>
                {selected.imageUrl ? <img key={selected.imageUrl} src={`${selected.imageUrl}?w=1200&auto=format`} alt={`Ilustración de archivo de ${selected.name}`} /> : <span className="archive__art-empty" aria-hidden="true">✦</span>}
                <span className="archive__art-caption">FIG. {String(selectedIndex + 1).padStart(2, '0')} — LÁMINA DE ARCHIVO / IDENTIFICACIÓN</span>
              </div>
              <div className="archive__hero-copy">
                <span className={`archive__threat archive__threat--${threat.className}`}><i /> {threat.label}</span>
                <p className="archive__hero-kicker">ENTIDAD / {String(selectedIndex + 1).padStart(3, '0')}</p>
                <h2>{selected.name}</h2>
                <p className="archive__hero-description">{selected.physicalDescription ?? 'La descripción física aún no ha sido verificada.'}</p>
                <div className="archive__hero-meta"><span>REGIÓN DE ORIGEN</span><strong>{selected.regions?.map((region) => region.name).join(' / ') || 'Sin confirmar'}</strong></div>
                <div className="archive__hero-meta"><span>EVALUACIÓN DE AMENAZA</span><strong>{threat.description}</strong></div>
                {selected.regionalNames?.length ? <div className="archive__hero-meta"><span>TAMBIÉN CONOCIDA COMO</span><strong>{selected.regionalNames.join(' / ')}</strong></div> : null}
              </div>
            </div>
            <div className="archive__details">
              <section className="archive__detail-block"><span className="archive__section-number">01 /</span><div><h3>Rasgos distintivos</h3><p>Rasgos característicos registrados en el archivo</p><ul className="archive__traits">{selected.distinctiveTraits?.length ? selected.distinctiveTraits.map((trait, index) => <li key={trait}><span>{String(index + 1).padStart(2, '0')}</span>{trait}</li>) : <li><span>—</span>Pendiente de confirmación en campo</li>}</ul></div></section>
              <section className="archive__detail-block"><span className="archive__section-number">02 /</span><div><h3>Origen y folclore</h3><p>Relatos preservados por generaciones</p><blockquote>{selected.folkloreOrigin ?? 'Aún no hay relatos sobre el origen de esta entidad.'}</blockquote><div className="archive__classification"><span>CLASIFICACIÓN DE ARCHIVO</span><strong>{threat.label}</strong></div></div></section>
            </div>
            <section className="archive__investigation" aria-labelledby="investigation-title">
              <div className="archive__investigation-heading">
                <div><span className="archive__section-number">03 / INFORMACIÓN DE CAMPO</span><h3 id="investigation-title">Rastro de avistamientos</h3><p>Avistamientos asociados a esta entidad, del más reciente al más antiguo.</p></div>
                <span className="archive__report-count">{String(creatureSightings.length).padStart(2, '0')} REPORTE{creatureSightings.length === 1 ? '' : 'S'}</span>
              </div>
              {sightingsStatus === 'loading' && <p className="archive__reports-message">Recuperando reportes de campo…</p>}
              {sightingsStatus === 'error' && <p className="archive__reports-message">Los reportes no están disponibles temporalmente. El perfil sigue accesible.</p>}
              {sightingsStatus === 'ready' && creatureSightings.length === 0 && <div className="archive__reports-empty"><span aria-hidden="true">◎</span><p>Aún no hay avistamientos registrados para esta entidad.</p><a href="/report">Enviar un reporte ↗</a></div>}
              {selectedSighting && <div className="archive__evidence-grid">
                <div className="archive__timeline" aria-label={`Avistamientos de ${selected.name}`}>
                  {creatureSightings.map((sighting, index) => <button key={sighting._id} type="button" className={`archive__timeline-item ${selectedSighting._id === sighting._id ? 'is-active' : ''}`} onClick={() => setSelectedSightingId(sighting._id)} aria-pressed={selectedSighting._id === sighting._id}>
                    <span className="archive__timeline-node" aria-hidden="true" />
                    <span className="archive__timeline-copy"><span className="archive__timeline-date">{formatSightingDate(sighting.date)} <small>REPORTE {String(creatureSightings.length - index).padStart(2, '0')}</small></span><strong>{sighting.region?.name ?? 'Ubicación sin confirmar'}</strong><span className="archive__timeline-excerpt">{sighting.freeformDescription || 'No hay relato del testigo.'}</span></span>
                    <span className="archive__timeline-chevron" aria-hidden="true">↗</span>
                  </button>)}
                </div>
                <div className="archive__evidence">
                  <div className="archive__evidence-top"><span>REPORTE SELECCIONADO</span><span className={`archive__filing-status archive__filing-status--${selectedSighting.status ?? 'pending'}`}>{selectedSighting.status === 'verified' ? 'VERIFICADO' : selectedSighting.status === 'dismissed' ? 'DESCARTADO' : 'EN REVISIÓN'}</span></div>
                  <div className="archive__evidence-meta"><div><span>FECHA</span><strong>{formatSightingDate(selectedSighting.date)}</strong></div><div><span>REGIÓN</span><strong>{selectedSighting.region?.name ?? 'Sin confirmar'}</strong></div><div><span>ÍNDICE DE CREDIBILIDAD</span><strong className="archive__credibility">{selectedSighting.credibilityIndex == null ? 'PENDIENTE' : `${Math.round(selectedSighting.credibilityIndex)} / 100`}</strong></div></div>
                  <blockquote className="archive__witness-account">“{selectedSighting.freeformDescription ?? 'No hay relato del testigo.'}”</blockquote>
                  <div className="archive__comparison"><div className="archive__comparison-heading"><span>04 / COMPARACIÓN DE RASGOS</span><strong>{matchedCount} <small>/ {canonicalTraits.length}</small></strong></div><p>Rasgos característicos mencionados en el reporte</p>
                    <ul>{canonicalTraits.length ? canonicalTraits.map((trait) => <li key={trait} className={observedSet.has(normalizeTrait(trait)) ? 'is-matched' : ''}><span aria-hidden="true">{observedSet.has(normalizeTrait(trait)) ? '✓' : '—'}</span>{trait}<small>{observedSet.has(normalizeTrait(trait)) ? 'OBSERVADO' : 'NO OBSERVADO'}</small></li>) : <li>Aún no hay rasgos característicos registrados.</li>}</ul>
                    {unlistedObservations.length > 0 && <div className="archive__unlisted"><span>OBSERVACIONES ADICIONALES</span><p>{unlistedObservations.join(' · ')}</p></div>}
                    <p className="archive__comparison-note">La comparación usa las observaciones del reporte. El índice también considera al testigo, la corroboración y el contexto regional.</p>
                  </div>
                  {selectedSighting.location && <a className="archive__map-link" href={`/map?sighting=${encodeURIComponent(selectedSighting._id)}`}><span>Ver esta señal en el radar</span><span aria-hidden="true">↗</span></a>}
                </div>
              </div>}
            </section>
            {selectedSighting && <ConnectionBoard sighting={selectedSighting} sightings={sightings} creatureName={selected.name} onOpenSighting={openConnectedReport} />}
            <div className="archive__profile-bottom"><span>FIN DEL EXPEDIENTE — {selected.name.toUpperCase()}</span><div><button type="button" onClick={() => stepCreature(-1)} aria-label="Entidad anterior">←</button><button type="button" onClick={() => stepCreature(1)} aria-label="Entidad siguiente">→</button></div></div>
          </> : <div className="archive__empty"><span>✦</span><h2>{status === 'loading' ? 'Abriendo el archivo…' : 'No hay expedientes disponibles'}</h2><p>{status === 'error' ? 'Revisa la conexión con el archivo e inténtalo de nuevo.' : 'El próximo reporte podría revelar lo que permanece oculto.'}</p></div>}
        </article>
      </div>

      <footer className="archive__footer"><span>PARANORMIS © ARCHIVO DE CAMPO</span><div className="archive__audio"><audio ref={audioRef} src="/audio/abyss.mp3" loop preload="none" onEnded={() => setMusicOn(false)} /><button type="button" onClick={toggleMusic} aria-pressed={musicOn} aria-label={musicOn ? 'Pausar ambiente' : 'Reproducir ambiente'}><span aria-hidden="true">{musicOn ? 'Ⅱ' : '♫'}</span> AMBIENTE {musicOn ? 'ACTIVO' : 'INACTIVO'}</button><span className="archive__music-credit">Pista: Abyss de Tetuano · Fuente: <a href="https://freetouse.com/music" target="_blank" rel="noopener noreferrer">freetouse.com/music</a> · Música libre de derechos</span></div></footer>
    </main>
  )
}












