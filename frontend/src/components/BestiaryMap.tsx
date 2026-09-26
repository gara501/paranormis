import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {sanityClient} from '../lib/sanity'
import {PUBLIC_SIGHTING_FILTER, casePath} from '../lib/editorial'
import {classForCreatureName, ENTITY_CLASSES, labelForEntityClass, type EntityClass} from '../data/entityClass'
import ParanormalOverlay from './map/ParanormalOverlay'
import type {MapSignal} from './map/types'
import SiteHeader from './SiteHeader'
import './BestiaryMap.css'
import '../styles/paranormis.css'

interface EnrichedSighting extends MapSignal {
  date: string
  dateBasis?: 'event' | 'approximate_event' | 'record_date'
  locationPrecision?: 'exact' | 'locality' | 'region'
  accountType?: string
  sourceTitle?: string
  sourceUrl?: string
  freeformDescription: string
  testimonyAudio?: {
    url?: string
    originalFilename?: string
    mimeType?: string
  } | null
  creature: {
    _id: string
    name: string
    threatLevel: string
    physicalDescription?: string
    distinctiveTraits?: string[]
    folkloreOrigin?: string
    imageUrl?: string
  } | null
  region: {name: string; country?: string; folkloreHistory?: string} | null
}

type SightingFromSanity = Omit<EnrichedSighting, 'entityClass'>
type ReceiverGraph = {
  context: AudioContext
  master: GainNode
  noiseGain: GainNode
  toneGain: GainNode
  clickBuffer: AudioBuffer
  clickRemainder: number
}

const SIGHTING_PROJECTION = `{
  _id,
  location,
  date,
  dateBasis,
  locationPrecision,
  accountType,
  sourceTitle,
  sourceUrl,
  credibilityIndex,
  status,
  freeformDescription,
  "testimonyAudio": testimonyAudio.asset->{url, originalFilename, mimeType},
  "creature": creature->{_id, name, threatLevel, physicalDescription, distinctiveTraits, folkloreOrigin, "imageUrl": archiveIllustration.asset->url},
  "region": region->{name, country, folkloreHistory}
}`

const CLASS_LABELS: Record<EntityClass, string> = {
  cryptid: 'Críptidos',
  specter: 'Espectros',
  entity: 'Entidades',
  anomaly: 'Anomalías',
}

function formatDate(value: string): string {
  return value
    ? new Date(value).toLocaleDateString('es-ES', {year: 'numeric', month: 'long', day: 'numeric'})
    : 'Fecha desconocida'
}

function dateLabel(basis?: EnrichedSighting['dateBasis']): string {
  if (basis === 'record_date') return 'Fuente publicada'
  if (basis === 'approximate_event') return 'Fecha aproximada del reporte'
  return 'Fecha del reporte'
}

function locationLabel(precision?: EnrichedSighting['locationPrecision']): string {
  if (precision === 'exact') return 'Ubicación indicada por la fuente'
  if (precision === 'locality') return 'Punto aproximado de la localidad'
  return 'Punto de referencia regional'
}

function accountLabel(type?: string): string {
  if (type === 'press_report') return 'Reporte de prensa'
  if (type === 'eyewitness') return 'Testimonio presencial'
  if (type === 'historical_text') return 'Texto histórico'
  if (type === 'case_history') return 'Historial de caso'
  return 'Relato registrado'
}

function threatLabel(level?: string): string {
  return ({harmless: 'Riesgo bajo', caution: 'Precaución', dangerous: 'Amenaza alta', unknown: 'Sin clasificar'}[level ?? 'unknown'] ?? 'Sin clasificar')
}

function audioConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext ?? (window as Window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext
}

function buildWhiteNoise(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1
  return buffer
}

function EntitySigil({entityClass}: {entityClass: EntityClass}) {
  return (
    <svg className={`entity-sigil entity-sigil--${entityClass}`} viewBox="0 0 24 24" aria-hidden="true">
      {entityClass === 'cryptid' && <path d="M5 4c3 4 3 11 5 16M10 3c2 5 2 12 4 17M15 4c1 5 2 10 4 15" />}
      {entityClass === 'specter' && <path d="M5 20V11a7 7 0 0 1 14 0v9l-3-2-2 2-2-2-3 2-2-2-2 2Zm4-9h.01M15 11h.01" />}
      {entityClass === 'entity' && <><path d="M4 6h16l-8 14L4 6Z" /><path d="M12 9v4m-2-2h4" /></>}
      {entityClass === 'anomaly' && <><ellipse cx="12" cy="13" rx="9" ry="3" /><path d="M8 12c.5-4 2-6 4-6s3.5 2 4 6M7 16l-2 4m12-4 2 4" /></>}
    </svg>
  )
}

function statusLabel(status: string): string {
  if (status === 'verified' || status === 'corroborated') return 'Corroborada'
  if (status === 'pending' || status === 'under review') return 'Sin corroborar'
  return 'Sin verificar'
}

export default function BestiaryMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map())
  const sightingsRef = useRef<Map<string, EnrichedSighting>>(new Map())
  const coordinateReadoutRef = useRef<HTMLSpanElement>(null)
  const emfMeterRef = useRef<HTMLSpanElement>(null)
  const dossierRef = useRef<HTMLElement>(null)
  const receiverRef = useRef<ReceiverGraph | null>(null)
  const randomTimeoutRef = useRef<number | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'live'>('connecting')
  const [sightings, setSightings] = useState<EnrichedSighting[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [mapLoadState, setMapLoadState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [selectedSighting, setSelectedSighting] = useState<EnrichedSighting | null>(null)
  const closeDossier = useCallback(() => setSelectedSighting(null), [])
  const [illustrationLoading, setIllustrationLoading] = useState(false)
  const [receiverOn, setReceiverOn] = useState(false)
  const [flashlightOn, setFlashlightOn] = useState(true)
  const [isGlitching, setIsGlitching] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [classVisibility, setClassVisibility] = useState<Record<EntityClass, boolean>>({
    cryptid: true,
    specter: true,
    entity: true,
    anomaly: true,
  })

  const visibleClasses = useMemo(
    () => new Set(ENTITY_CLASSES.filter((entityClass) => classVisibility[entityClass])),
    [classVisibility],
  )
  const visibleSightings = useMemo(
    () => sightings.filter((sighting) => visibleClasses.has(sighting.entityClass)),
    [sightings, visibleClasses],
  )
  const classCounts = useMemo(() => {
    const counts: Record<EntityClass, number> = {cryptid: 0, specter: 0, entity: 0, anomaly: 0}
    for (const sighting of sightings) counts[sighting.entityClass] += 1
    return counts
  }, [sightings])

  const publishSightings = useCallback(() => {
    setSightings([...sightingsRef.current.values()])
  }, [])

  const onReceiverLevel = useCallback((level: number, dt: number) => {
    const meter = emfMeterRef.current
    if (meter) {
      for (let index = 0; index < meter.children.length; index += 1) {
        meter.children.item(index)?.classList.toggle('is-lit', level >= (index + 1) / 5)
      }
      const value = String(Math.round(level * 100))
      if (meter.getAttribute('aria-valuenow') !== value) meter.setAttribute('aria-valuenow', value)
    }
    const receiver = receiverRef.current
    if (!receiver || receiver.context.state === 'closed') return
    const now = receiver.context.currentTime
    receiver.noiseGain.gain.setTargetAtTime(0.015 + level * 0.09, now, 0.04)
    receiver.toneGain.gain.setTargetAtTime(level > 0.75 ? (level - 0.75) * 0.25 : 0, now, 0.05)
    receiver.clickRemainder += dt * level * 30
    if (receiver.clickRemainder >= 1) {
      receiver.clickRemainder -= 1
      const source = receiver.context.createBufferSource()
      const envelope = receiver.context.createGain()
      source.buffer = receiver.clickBuffer
      envelope.gain.setValueAtTime(0.08, now)
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.012)
      source.connect(envelope).connect(receiver.master)
      source.start(now)
      source.stop(now + 0.02)
    }
  }, [])

  const focusSighting = useCallback((sighting: EnrichedSighting, duration = 1.25) => {
    setIllustrationLoading(Boolean(sighting.creature?.imageUrl))
    setSelectedSighting(sighting)
    const map = mapRef.current
    if (!map) return
    const target: L.LatLngExpression = [sighting.location.lat, sighting.location.lng]
    const zoom = Math.max(map.getZoom(), 5)
    if (reducedMotion) map.setView(target, zoom)
    else map.flyTo(target, zoom, {duration})
  }, [reducedMotion])

  const selectSighting = useCallback((id: string) => {
    const sighting = sightingsRef.current.get(id)
    if (sighting) focusSighting(sighting)
  }, [focusSighting])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [10, -20],
      zoom: 2,
      zoomControl: true,
    })
    const baseLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxZoom: 19,
      crossOrigin: true,
      updateWhenIdle: true,
    }).addTo(map)

    baseLayer.once('load', () => setMapLoadState('ready'))
    const loadTimeout = window.setTimeout(() => {
      setMapLoadState((state) => (state === 'loading' ? 'unavailable' : state))
    }, 9000)
    mapRef.current = map
    setMapInstance(map)

    map.on('mousemove', (event: L.LeafletMouseEvent) => {
      if (coordinateReadoutRef.current) {
        coordinateReadoutRef.current.textContent = `${event.latlng.lat.toFixed(3)}° / ${event.latlng.lng.toFixed(3)}°`
      }
    })

    return () => {
      window.clearTimeout(loadTimeout)
      if (randomTimeoutRef.current) window.clearTimeout(randomTimeoutRef.current)
      if (receiverRef.current) {
        receiverRef.current.context.close()
        receiverRef.current = null
      }
      map.remove()
      mapRef.current = null
      setMapInstance(null)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    function enrich(raw: SightingFromSanity): EnrichedSighting {
      return {...raw, entityClass: classForCreatureName(raw.creature?.name)}
    }

    function upsertMarker(raw: SightingFromSanity) {
      const sighting = enrich(raw)
      const map = mapRef.current
      if (!map || !sighting.location) return
      sightingsRef.current.set(sighting._id, sighting)
      const existing = markersRef.current.get(sighting._id)
      if (existing) {
        existing.setLatLng([sighting.location.lat, sighting.location.lng])
      } else {
        // Invisible Leaflet points preserve coordinate indexing and bounds; the canvas owns visual signals and hit testing.
        const marker = L.circleMarker([sighting.location.lat, sighting.location.lng], {
          radius: 1,
          opacity: 0,
          fillOpacity: 0,
          interactive: false,
          keyboard: false,
        }).addTo(map)
        markersRef.current.set(sighting._id, marker)
      }
    }

    function removeMarker(id: string) {
      setSelectedSighting(current => current?._id === id ? null : current)
      const marker = markersRef.current.get(id)
      if (marker) marker.remove()
      markersRef.current.delete(id)
      sightingsRef.current.delete(id)
    }

    async function loadInitialSightings() {
      try {
        const params = new URLSearchParams(window.location.search)
        const targetId = params.get('sighting') ?? params.get('report')
        const targetSightingPromise: Promise<SightingFromSanity | null> = targetId
          ? sanityClient.fetch(`*[${PUBLIC_SIGHTING_FILTER} && _id == $id][0] ${SIGHTING_PROJECTION}`, {id: targetId})
          : Promise.resolve(null)
        const [loadedSightings, targetSighting] = await Promise.all([
          sanityClient.fetch<SightingFromSanity[]>(`*[${PUBLIC_SIGHTING_FILTER} && defined(location)] ${SIGHTING_PROJECTION}`),
          targetSightingPromise,
        ])
        if (!isMounted) return
        loadedSightings.forEach(upsertMarker)
        if (targetSighting?.location) {
          upsertMarker(targetSighting)
          window.setTimeout(() => {
            const selected = sightingsRef.current.get(targetSighting._id)
            if (selected) focusSighting(selected)
          }, 180)
        }
        publishSightings()
        setConnectionStatus('live')
      } catch (error) {
        console.error('[Paranormis radar] No se pudieron cargar las señales:', error)
      }
    }

    loadInitialSightings()
    const subscription = sanityClient.listen(`*[${PUBLIC_SIGHTING_FILTER}]`, {}, {tag: 'paranormis-map-live'}).subscribe({
      next: async (update) => {
        if (!isMounted) return
        setConnectionStatus('live')
        if (update.transition === 'disappear') {
          removeMarker(update.documentId)
          publishSightings()
          return
        }
        const fresh: SightingFromSanity | null = await sanityClient.fetch(
          `*[${PUBLIC_SIGHTING_FILTER} && _id == $id][0] ${SIGHTING_PROJECTION}`,
          {id: update.documentId},
        )
        if (!isMounted) return
        if (fresh?.location) upsertMarker(fresh)
        else removeMarker(update.documentId)
        publishSightings()
      },
      error: (error) => console.error('[Paranormis radar] Error en la conexión en vivo:', error),
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [focusSighting, publishSightings])

  useEffect(() => {
    if (!selectedSighting) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDossier()
    }
    window.addEventListener('keydown', closeOnEscape)
    dossierRef.current?.focus()
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedSighting, closeDossier])

  function scanForSignals() {
    const map = mapRef.current
    if (!map || visibleSightings.length === 0) return
    setIsScanning(true)
    const bounds = L.latLngBounds(visibleSightings.map((sighting) => L.latLng(sighting.location.lat, sighting.location.lng)))
    map.flyToBounds(bounds, {padding: [88, 88], maxZoom: 7, duration: reducedMotion ? 0 : 1.6, animate: !reducedMotion})
    window.setTimeout(() => setIsScanning(false), reducedMotion ? 150 : 1800)
  }

  function discoverRandomSignal() {
    if (visibleSightings.length === 0) return
    const sighting = visibleSightings[Math.floor(Math.random() * visibleSightings.length)]
    setIsGlitching(true)
    if (randomTimeoutRef.current) window.clearTimeout(randomTimeoutRef.current)
    randomTimeoutRef.current = window.setTimeout(() => {
      focusSighting(sighting, 1.4)
      randomTimeoutRef.current = window.setTimeout(() => setIsGlitching(false), 70)
    }, 380)
  }

  async function toggleReceiver() {
    const existing = receiverRef.current
    if (existing) {
      const now = existing.context.currentTime
      existing.master.gain.setTargetAtTime(0, now, 0.015)
      existing.noiseGain.gain.setTargetAtTime(0, now, 0.015)
      existing.toneGain.gain.setTargetAtTime(0, now, 0.015)
      receiverRef.current = null
      setReceiverOn(false)
      window.setTimeout(() => void existing.context.close(), 50)
      return
    }

    const Audio = audioConstructor()
    if (!Audio) return
    const context = new Audio()
    await context.resume()
    const master = context.createGain()
    master.gain.value = 0.68
    master.connect(context.destination)

    const noise = context.createBufferSource()
    noise.buffer = buildWhiteNoise(context, 0.5)
    noise.loop = true
    const bandpass = context.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = 1600
    bandpass.Q.value = 0.7
    const noiseGain = context.createGain()
    noiseGain.gain.value = 0.015
    noise.connect(bandpass).connect(noiseGain).connect(master)
    noise.start()

    const tone = context.createOscillator()
    tone.type = 'sine'
    tone.frequency.value = 220
    const toneGain = context.createGain()
    toneGain.gain.value = 0
    const lfo = context.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 5.5
    const lfoDepth = context.createGain()
    lfoDepth.gain.value = 14
    lfo.connect(lfoDepth).connect(tone.frequency)
    tone.connect(toneGain).connect(master)
    tone.start()
    lfo.start()

    receiverRef.current = {
      context,
      master,
      noiseGain,
      toneGain,
      clickBuffer: buildWhiteNoise(context, 0.02),
      clickRemainder: 0,
    }
    setReceiverOn(true)
  }

  function toggleClass(entityClass: EntityClass) {
    setClassVisibility((current) => ({...current, [entityClass]: !current[entityClass]}))
  }

  return (
    <main className={`bestiary-map-wrap${isGlitching ? ' bestiary-map-wrap--glitch' : ''}`}>
      <SiteHeader active="map" overlay />
      <div className="bestiary-map__atmosphere" aria-hidden="true" />
      {mapLoadState !== 'ready' && (
        <div className="bestiary-map__loader" role="status" aria-live="polite">
          <div className="bestiary-map__loader-ring" aria-hidden="true"><span>✦</span></div>
          <p className="bestiary-map__loader-kicker">Unidad de Cartografía Anómala</p>
          <p className="bestiary-map__loader-title">
            {mapLoadState === 'loading' ? 'Calibrando el radar' : 'Señal cartográfica no disponible'}
          </p>
          <p className="bestiary-map__loader-copy">
            {mapLoadState === 'loading'
              ? 'Buscando actividad en el mapa y calibrando los sensores…'
              : 'El archivo sigue activo. Revisa la conexión y vuelve a cargar el radar.'}
          </p>
        </div>
      )}
      <div className="bestiary-map__header">
        <p className="bestiary-map__eyebrow">Unidad de campo · Cartografía restringida</p>
        <h1 className="bestiary-map__title">Paranormis</h1>
        <div className="bestiary-map__subline">
          <span className={`bestiary-map__status ${connectionStatus === 'connecting' ? 'bestiary-map__status--connecting' : ''}`}>
            <i /> {connectionStatus === 'connecting' ? 'Conectando sensores' : `Radar activo · ${visibleSightings.length} señales`}
          </span>
          <span className="bestiary-map__sector">Sector global</span>
        </div>
      </div>
      <div ref={mapContainerRef} className="bestiary-map__canvas" />

      {mapInstance && (
        <ParanormalOverlay
          map={mapInstance}
          signals={sightings}
          visibleClasses={visibleClasses}
          selectedSignalId={selectedSighting?._id ?? null}
          flashlightOn={flashlightOn}
          receiverActive={receiverOn}
          staticBurst={isGlitching}
          reducedMotion={reducedMotion}
          onSelect={selectSighting}
          onDismiss={closeDossier}
          onReceiverLevel={onReceiverLevel}
        />
      )}

      <aside className="bestiary-map__legend" aria-label="Leyenda y filtros de señales">
        <p className="bestiary-map__panel-label">Estado de la señal</p>
        <div className="signal-status"><span className="legend-dot legend-dot--high" /> Corroborada</div>
        <div className="signal-status"><span className="legend-dot legend-dot--mid" /> Sin corroborar</div>
        <div className="signal-status"><span className="legend-dot legend-dot--low" /> Sin verificar</div>
        <p className="bestiary-map__panel-label entity-filter-heading">Clase de entidad</p>
        <div className="entity-class-filters">
          {ENTITY_CLASSES.map((entityClass) => (
            <button
              key={entityClass}
              className={`entity-class-filter${classVisibility[entityClass] ? ' is-active' : ''}`}
              type="button"
              aria-pressed={classVisibility[entityClass]}
              onClick={() => toggleClass(entityClass)}
              title={`${classVisibility[entityClass] ? 'Ocultar' : 'Mostrar'} ${CLASS_LABELS[entityClass].toLocaleLowerCase('es')}`}
            >
              <EntitySigil entityClass={entityClass} />
              <span>{labelForEntityClass(entityClass)}</span>
              <b>{classCounts[entityClass]}</b>
            </button>
          ))}
        </div>
      </aside>

      <ul className="bestiary-map__accessible-list" aria-label="Señales visibles, lista accesible">
        {visibleSightings.map((sighting) => (
          <li key={sighting._id}>
            <button type="button" onClick={() => focusSighting(sighting)}>
              {sighting.creature?.name ?? 'Entidad sin clasificar'} · {sighting.region?.name ?? 'Región desconocida'} · {statusLabel(sighting.status)}
            </button>
          </li>
        ))}
      </ul>

      <div className="bestiary-map__instrument">
        <div className="bestiary-map__compass" aria-hidden="true"><span>N</span><b>✦</b></div>
        <p><span>Posición del cursor</span><strong ref={coordinateReadoutRef}>— / —</strong><small>COORDENADAS GPS</small></p>
        <div className={`bestiary-map__waveform${receiverOn ? ' is-active' : ''}`} aria-label="Monitor de audio EVP">{Array.from({length: 17}, (_, index) => <i key={index} />)}</div>
      </div>

      <button className={`bestiary-map__scan ${isScanning ? 'bestiary-map__scan--active' : ''}`} type="button" onClick={scanForSignals} disabled={visibleSightings.length === 0}>
        <span className="bestiary-map__scan-icon" aria-hidden="true">⌁</span>
        {isScanning ? 'Triangulando…' : 'Rastrear señales'}
      </button>
      <div className="bestiary-map__explore-controls">
        <a className="bestiary-map__archive-link" href="/bestiary"><span aria-hidden="true">✦</span> Abrir el archivo <span aria-hidden="true">↗</span></a>
        <a className="bestiary-map__report-link" href="/explorar"><span aria-hidden="true">⌖</span> Buscar por ciudad</a>
        <button type="button" className="bestiary-map__explore" onClick={discoverRandomSignal} disabled={visibleSightings.length === 0}>
          <span aria-hidden="true">✦</span> Señal aleatoria
        </button>
        <button type="button" className="bestiary-map__flashlight" onClick={() => setFlashlightOn((value) => !value)} aria-pressed={flashlightOn}>
          <span aria-hidden="true">◉</span> Linterna: {flashlightOn ? 'encendida' : 'apagada'}
        </button>
        <button
          type="button"
          className={`bestiary-map__receiver ${receiverOn ? 'bestiary-map__receiver--on' : ''}`}
          onClick={() => void toggleReceiver()}
          aria-pressed={receiverOn}
          disabled={!audioConstructor()}
          title={!audioConstructor() ? 'Este navegador no ofrece Web Audio' : 'Activar o silenciar el receptor EVP'}
        >
          <span aria-hidden="true">⌁</span> Receptor EVP
          <span ref={emfMeterRef} className="emf-meter" role="meter" aria-label="Intensidad del receptor electromagnético" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
            {[0, 1, 2, 3, 4].map((segment) => <i key={segment} />)}
          </span>
          <span className="receiver-state">{receiverOn ? 'activo' : 'inactivo'}</span>
        </button>
      </div>

      {selectedSighting && (
        <aside ref={dossierRef} className="creature-dossier" aria-label={`Expediente de ${selectedSighting.creature?.name ?? 'entidad sin clasificar'}`} tabIndex={-1}>
          <div className="creature-dossier__toolbar">
            <span>Expediente del avistamiento</span>
            <button type="button" className="creature-dossier__close" onClick={closeDossier} aria-label="Cerrar expediente"><span aria-hidden="true">×</span> Cerrar</button>
          </div>
          <div className="creature-dossier__image-wrap">
            {illustrationLoading && <div className="creature-dossier__revelation" role="status" aria-live="polite"><span className="creature-dossier__revelation-sigil">✦</span><span>Revelando imagen</span></div>}
            {selectedSighting.creature?.imageUrl ? (
              <img src={selectedSighting.creature.imageUrl} alt={`Ilustración de ${selectedSighting.creature.name}`} className={`creature-dossier__image ${illustrationLoading ? 'creature-dossier__image--loading' : ''}`} onLoad={() => setIllustrationLoading(false)} onError={() => setIllustrationLoading(false)} />
            ) : <div className="creature-dossier__missing-image">?</div>}
            <span className="creature-dossier__stamp">Expediente abierto</span>
          </div>
          <div className="creature-dossier__body">
            <a className="creature-dossier__archive-link" href={casePath(selectedSighting._id)}>Abrir, guardar y compartir expediente ↗</a>
            <p className="creature-dossier__eyebrow">{selectedSighting.region?.country ?? 'Archivo global'} · {dateLabel(selectedSighting.dateBasis)}: {formatDate(selectedSighting.date)}</p>
            <h2>{selectedSighting.creature?.name ?? 'Entidad sin clasificar'}</h2>
            <div className="creature-dossier__badges"><span>{threatLabel(selectedSighting.creature?.threatLevel)}</span><span>{accountLabel(selectedSighting.accountType)}</span><span>{statusLabel(selectedSighting.status)}</span><span>{selectedSighting.credibilityIndex == null ? 'Credibilidad sin calcular' : `Credibilidad ${selectedSighting.credibilityIndex}%`}</span></div>
            <p className="creature-dossier__location">Reporte situado en <strong>{selectedSighting.region?.name ?? 'región desconocida'}</strong> · {locationLabel(selectedSighting.locationPrecision)}</p>
            {selectedSighting.creature?.physicalDescription && <p className="creature-dossier__description">{selectedSighting.creature.physicalDescription}</p>}
            {selectedSighting.creature?.distinctiveTraits?.length ? <div className="creature-dossier__traits"><p>Rasgos registrados</p>{selectedSighting.creature.distinctiveTraits.slice(0, 5).map((trait) => <span key={trait}>{trait}</span>)}</div> : null}
            <blockquote>{selectedSighting.freeformDescription}</blockquote>
            {selectedSighting.sourceUrl && selectedSighting.sourceTitle && <p className="creature-dossier__origin">Fuente: <a href={selectedSighting.sourceUrl} target="_blank" rel="noopener noreferrer">{selectedSighting.sourceTitle} ↗</a></p>}
            {selectedSighting.testimonyAudio?.url && (
              <section className="creature-dossier__testimony" aria-label="Testimonio de audio del testigo">
                <p><span aria-hidden="true">◉</span> Grabación EVP recuperada</p>
                <audio controls preload="metadata"><source src={selectedSighting.testimonyAudio.url} type={selectedSighting.testimonyAudio.mimeType} />Tu navegador no puede reproducir este audio.</audio>
                {selectedSighting.testimonyAudio.originalFilename && <small>{selectedSighting.testimonyAudio.originalFilename}</small>}
              </section>
            )}
            {selectedSighting.creature?.folkloreOrigin && <p className="creature-dossier__origin">Nota del archivo: {selectedSighting.creature.folkloreOrigin}</p>}
            {selectedSighting.creature?._id && <a className="creature-dossier__archive-link" href={`/bestiary#${encodeURIComponent(selectedSighting.creature._id)}`}>Ver perfil completo <span aria-hidden="true">↗</span></a>}
          </div>
        </aside>
      )}
    </main>
  )
}







