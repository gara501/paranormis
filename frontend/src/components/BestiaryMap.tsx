import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import type {PointerEvent as ReactPointerEvent} from 'react'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {PUBLIC_SIGHTING_FILTER, casePath} from '../lib/editorial'
import {classForCreatureName, ENTITY_CLASSES, labelForEntityClass, type EntityClass} from '../data/entityClass'
import ParanormalOverlay from './map/ParanormalOverlay'
import type {MapSignal} from './map/types'
import SiteHeader from './SiteHeader'
import './BestiaryMap.css'
import '../styles/paranormis.css'

interface EnrichedSighting extends MapSignal {
  title?: string
  date: string
  dateBasis?: 'event' | 'approximate_event' | 'record_date'
  locationPrecision?: 'exact' | 'locality' | 'region'
  accountType?: string
  city?: string
  timeOfDay?: string
  imageUrl?: string
  imageAlt?: string
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
    imageAlt?: string
  } | null
  region: {name: string; country?: string; folkloreHistory?: string} | null
}

type SightingFromSanity = Omit<EnrichedSighting, 'entityClass'>
type MapRoute = { _id: string; title: string; slug: {current: string}; city: string; description: string; estimatedMinutes: number; stops: {note?: string; sighting?: {title?: string; city?: string; location?: {lat: number; lng: number}} | null}[] }
type MapTerritory = { _id: string; name: string; description: string; area: {lat: number; lng: number}[]; creature?: {_id: string; name: string; slug?: {current: string}} | null }
type ReceiverGraph = {
  context: AudioContext
  master: GainNode
  noiseGain: GainNode
  toneGain: GainNode
  clickBuffer: AudioBuffer
  clickRemainder: number
  spatialVoices: Map<string, SpatialVoice>
  audioBuffers: Map<string, AudioBuffer>
  audioLoading: Set<string>
}

type SpatialVoice = {source: AudioBufferSourceNode; gain: GainNode; panner: StereoPannerNode; stopTimer: number | null}
type NearbyAudioSignal = {id: string; url?: string; proximity: number; pan: number}

const SIGHTING_PROJECTION = `{
  _id, title, city, timeOfDay,
  "imageUrl": image.asset->url, "imageAlt": image.alt,
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
  "creature": creature->{_id, name, threatLevel, physicalDescription, distinctiveTraits, folkloreOrigin, "imageUrl": coalesce(image.asset->url, archiveIllustration.asset->url), "imageAlt": image.alt},
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

function updateSpatialAudio(receiver: ReceiverGraph, signals: readonly NearbyAudioSignal[]) {
  const now = receiver.context.currentTime
  const desired = signals.filter((signal) => signal.url && signal.proximity > 0).slice(0, 3)
  const desiredIds = new Set(desired.map((signal) => signal.id))
  for (const [id, voice] of receiver.spatialVoices) {
    if (!desiredIds.has(id)) {
      voice.gain.gain.setTargetAtTime(0, now, .12)
      if (voice.stopTimer === null) voice.stopTimer = window.setTimeout(() => {
        if (receiver.spatialVoices.get(id) !== voice) return
        try { voice.source.stop() } catch { /* The source may already have ended. */ }
        receiver.spatialVoices.delete(id)
      }, 520)
    }
  }
  for (const signal of desired) {
    const existing = receiver.spatialVoices.get(signal.id)
    if (existing) {
      if (existing.stopTimer !== null) { window.clearTimeout(existing.stopTimer); existing.stopTimer = null }
      existing.gain.gain.setTargetAtTime(.16 * signal.proximity, now, .14)
      existing.panner.pan.setTargetAtTime(signal.pan, now, .12)
      continue
    }
    if (receiver.spatialVoices.size + receiver.audioLoading.size >= 3 || !signal.url || receiver.audioLoading.has(signal.id)) continue
    receiver.audioLoading.add(signal.id)
    const loadBuffer = receiver.audioBuffers.get(signal.id)
      ? Promise.resolve(receiver.audioBuffers.get(signal.id)!)
      : fetch(signal.url).then((response) => { if (!response.ok) throw new Error('No se pudo descargar el audio'); return response.arrayBuffer() }).then((data) => receiver.context.decodeAudioData(data)).then((buffer) => { receiver.audioBuffers.set(signal.id, buffer); return buffer })
    void loadBuffer.then((buffer) => {
      if (receiver.context.state === 'closed' || receiver.spatialVoices.size >= 3) return
      const source = receiver.context.createBufferSource()
      const gain = receiver.context.createGain()
      const panner = receiver.context.createStereoPanner()
      source.buffer = buffer
      source.loop = true
      gain.gain.value = 0
      panner.pan.value = signal.pan
      source.connect(gain).connect(panner).connect(receiver.master)
      source.start()
      gain.gain.setTargetAtTime(.16 * signal.proximity, receiver.context.currentTime, .18)
      receiver.spatialVoices.set(signal.id, {source, gain, panner, stopTimer: null})
    }).catch((error) => console.warn('[Paranormis radar] No se pudo abrir el audio del testimonio:', error)).finally(() => receiver.audioLoading.delete(signal.id))
  }
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
  if (status === 'verified' || status === 'corroborated') return 'Con corroboración registrada'
  if (status === 'pending' || status === 'under review') return 'En revisión'
  return 'Sin corroboración registrada'
}

export default function BestiaryMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<Leaflet.Map | null>(null)
  const markersRef = useRef<Map<string, Leaflet.CircleMarker>>(new Map())
  const sightingsRef = useRef<Map<string, EnrichedSighting>>(new Map())
  const coordinateReadoutRef = useRef<HTMLSpanElement>(null)
  const emfMeterRef = useRef<HTMLSpanElement>(null)
  const dossierRef = useRef<HTMLElement>(null)
  const receiverRef = useRef<ReceiverGraph | null>(null)
  const randomTimeoutRef = useRef<number | null>(null)
  const glitchTimeoutRef = useRef<number | null>(null)
  const sheetDragRef = useRef<{pointerId: number; startY: number; lastY: number} | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'live'>('connecting')
  const [sightings, setSightings] = useState<EnrichedSighting[]>([])
  const [routes, setRoutes] = useState<MapRoute[]>([])
  const [territories, setTerritories] = useState<MapTerritory[]>([])
  const [routesEnabled, setRoutesEnabled] = useState(false)
  const [territoriesEnabled, setTerritoriesEnabled] = useState(false)
  const [yearRange, setYearRange] = useState<[number, number] | null>(null)
  const [timelinePlaying, setTimelinePlaying] = useState(false)
  const [playbackIndex, setPlaybackIndex] = useState(-1)
  const [isWitchingHour, setIsWitchingHour] = useState(false)
  const routeLayerRef = useRef<Leaflet.LayerGroup | null>(null)
  const territoryLayerRef = useRef<Leaflet.LayerGroup | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [mapLoadState, setMapLoadState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [selectedSighting, setSelectedSighting] = useState<EnrichedSighting | null>(null)
  const closeDossier = useCallback(() => {
    setSelectedSighting(null)
    setPreviewSighting(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('sighting')
    url.searchParams.delete('report')
    window.history.replaceState(null, '', url)
  }, [])
  const [illustrationLoading, setIllustrationLoading] = useState(false)
  const [receiverOn, setReceiverOn] = useState(false)
  const [flashlightOn, setFlashlightOn] = useState(true)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [isGlitching, setIsGlitching] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [previewSighting, setPreviewSighting] = useState<EnrichedSighting | null>(null)
  const [liveSighting, setLiveSighting] = useState<EnrichedSighting | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const tutorialSteps = [
    {title: 'Linterna de campo', copy: 'Mueve la luz para revelar señales ocultas en el sector.'},
    {title: 'Receptor EVP', copy: 'Activa el receptor para escuchar interferencias cerca de los reportes.'},
    {title: 'Señal aleatoria', copy: 'Pide al radar que seleccione un expediente del archivo.'},
  ]
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
  const classVisibleSightings = useMemo(
    () => sightings.filter((sighting) => visibleClasses.has(sighting.entityClass)),
    [sightings, visibleClasses],
  )
  const yearBounds = useMemo<[number, number] | null>(() => {
    const years = sightings.map((sighting) => new Date(sighting.date).getUTCFullYear()).filter(Number.isFinite)
    return years.length ? [Math.min(...years), Math.max(...years)] : null
  }, [sightings])
  const activeYearRange = yearRange ?? yearBounds
  const visibleSightings = useMemo(() => classVisibleSightings.filter((sighting) => {
    if (!activeYearRange) return true
    const year = new Date(sighting.date).getUTCFullYear()
    return year >= activeYearRange[0] && year <= activeYearRange[1]
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [classVisibleSightings, activeYearRange])
  const timelineEvents = visibleSightings
  const orderedSightings = visibleSightings
  const classCounts = useMemo(() => {
    const counts: Record<EntityClass, number> = {cryptid: 0, specter: 0, entity: 0, anomaly: 0}
    for (const sighting of sightings) counts[sighting.entityClass] += 1
    return counts
  }, [sightings])

  const publishSightings = useCallback(() => {
    setSightings([...sightingsRef.current.values()])
  }, [])

  const onReceiverLevel = useCallback((level: number, dt: number, nearby: readonly NearbyAudioSignal[] = []) => {
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
    const presence = nearby.reduce((strongest, signal) => Math.max(strongest, signal.proximity), 0)
    receiver.noiseGain.gain.setTargetAtTime((0.015 + level * 0.09) * (1 - presence * .62), now, 0.06)
    receiver.toneGain.gain.setTargetAtTime(level > 0.75 ? (level - 0.75) * 0.25 : 0, now, 0.05)
    updateSpatialAudio(receiver, nearby)
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

  const focusSighting = useCallback((sighting: EnrichedSighting, duration = 1.25, syncUrl = true) => {
    setIllustrationLoading(Boolean(sighting.imageUrl || sighting.creature?.imageUrl))
    setSelectedSighting(sighting)
    setPreviewSighting(null)
    if (syncUrl) {
      const url = new URL(window.location.href)
      url.searchParams.set('sighting', sighting._id)
      url.searchParams.delete('report')
      if (url.search !== window.location.search) window.history.pushState({sighting: sighting._id}, '', url)
    }
    const map = mapRef.current
    if (!map) return
    const target: Leaflet.LatLngExpression = [sighting.location.lat, sighting.location.lng]
    const zoom = Math.max(map.getZoom(), 5)
    if (reducedMotion) map.setView(target, zoom)
    else map.flyTo(target, zoom, {duration})
  }, [reducedMotion])

  const selectSighting = useCallback((id: string) => {
    const sighting = sightingsRef.current.get(id)
    if (sighting) focusSighting(sighting)
  }, [focusSighting])
  const previewSignal = useCallback((id: string | null) => {
    setPreviewSighting(id ? sightingsRef.current.get(id) ?? null : null)
  }, [])

  const finishTutorial = useCallback(() => {
    setTutorialOpen(false)
    try { window.localStorage.setItem('paranormis-map-tutorial-seen', '1') } catch { /* Storage may be disabled. */ }
  }, [])

  const onReveal = useCallback((_id: string) => {
    if (reducedMotion) return
    if ('vibrate' in navigator) navigator.vibrate(30)
    setIsGlitching(true)
    if (glitchTimeoutRef.current) window.clearTimeout(glitchTimeoutRef.current)
    glitchTimeoutRef.current = window.setTimeout(() => setIsGlitching(false), 300)
    const receiver = receiverRef.current
    if (receiver && receiver.context.state !== 'closed') {
      const now = receiver.context.currentTime
      receiver.noiseGain.gain.setTargetAtTime(.16, now, .035)
      window.setTimeout(() => {
        if (receiverRef.current === receiver && receiver.context.state !== 'closed') receiver.noiseGain.gain.setTargetAtTime(.025, receiver.context.currentTime, .11)
      }, 260)
    }
  }, [reducedMotion])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (yearBounds && !yearRange) setYearRange(yearBounds)
  }, [yearBounds, yearRange])

  useEffect(() => {
    const update = () => { const now = new Date(); setIsWitchingHour(now.getHours() >= 0 && now.getHours() < 4) }
    update()
    const interval = window.setInterval(update, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!timelinePlaying) return
    const timer = window.setTimeout(() => {
      const next = playbackIndex + 1
      if (next >= timelineEvents.length) { setTimelinePlaying(false); setPlaybackIndex(-1); return }
      focusSighting(timelineEvents[next], 0, false)
      setPlaybackIndex(next)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [timelinePlaying, playbackIndex, timelineEvents, focusSighting])

  useEffect(() => {
    try {
      if (window.localStorage.getItem('paranormis-map-tutorial-seen') !== '1') setTutorialOpen(true)
    } catch { setTutorialOpen(true) }
  }, [])

  useEffect(() => {
    if (!tutorialOpen) return
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') finishTutorial() }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [tutorialOpen, finishTutorial])

  useEffect(() => {
    const onPopState = () => {
      const id = new URLSearchParams(window.location.search).get('sighting') ?? new URLSearchParams(window.location.search).get('report')
      if (!id) { setSelectedSighting(null); setPreviewSighting(null); return }
      const sighting = sightingsRef.current.get(id)
      if (sighting) focusSighting(sighting, 0, false)
      else setSelectedSighting(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [focusSighting])

  useEffect(() => {
    if (!selectedSighting) return
    const onArrow = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const index = orderedSightings.findIndex((item) => item._id === selectedSighting._id)
      if (index < 0 || !orderedSightings.length) return
      event.preventDefault()
      const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + orderedSightings.length) % orderedSightings.length
      focusSighting(orderedSightings[nextIndex])
    }
    window.addEventListener('keydown', onArrow)
    return () => window.removeEventListener('keydown', onArrow)
  }, [selectedSighting, orderedSightings, focusSighting])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    let cancelled = false
    let loadTimeout = 0
    let map: Leaflet.Map | null = null
    void import('leaflet').then(({default: L}) => {
      if (cancelled || !mapContainerRef.current) return
      leafletRef.current = L
      map = L.map(mapContainerRef.current, {center: [4.5709, -74.2973], zoom: 5, zoomControl: true})
      const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd', maxZoom: 20, crossOrigin: true, updateWhenIdle: true,
      }).addTo(map)
      baseLayer.once('load', () => setMapLoadState('ready'))
      loadTimeout = window.setTimeout(() => setMapLoadState((state) => state === 'loading' ? 'unavailable' : state), 9000)
      mapRef.current = map
      setMapInstance(map)
      map.on('mousemove', (event: Leaflet.LeafletMouseEvent) => {
        if (coordinateReadoutRef.current) coordinateReadoutRef.current.textContent = `${event.latlng.lat.toFixed(3)}° / ${event.latlng.lng.toFixed(3)}°`
      })
      map.on('click', (event: Leaflet.LeafletMouseEvent) => {
        if (coordinateReadoutRef.current) coordinateReadoutRef.current.textContent = `${event.latlng.lat.toFixed(3)}° / ${event.latlng.lng.toFixed(3)}°`
      })
    }).catch((error) => {
      console.error('[Paranormis radar] No se pudo cargar el mapa:', error)
      setMapLoadState('unavailable')
    })

    return () => {
      cancelled = true
      window.clearTimeout(loadTimeout)
      if (randomTimeoutRef.current) window.clearTimeout(randomTimeoutRef.current)
      if (glitchTimeoutRef.current) window.clearTimeout(glitchTimeoutRef.current)
      if (receiverRef.current) {
        receiverRef.current.context.close()
        receiverRef.current = null
      }
      map?.remove()
      mapRef.current = null
      leafletRef.current = null
      setMapInstance(null)
    }
  }, [])

  useEffect(() => {
    if (!mapInstance) return
    let isMounted = true
    let subscription: {unsubscribe: () => void} | null = null
    const L = leafletRef.current
    if (!L) return

    function enrich(raw: SightingFromSanity): EnrichedSighting {
      return {...raw, testimonyAudioUrl: raw.testimonyAudio?.url, entityClass: classForCreatureName(raw.creature?.name)}
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

    async function loadInitialSightings(sanityClient: typeof import('../lib/sanity').sanityClient) {
      try {
        const params = new URLSearchParams(window.location.search)
        const targetId = params.get('sighting') ?? params.get('report')
        const targetSightingPromise: Promise<SightingFromSanity | null> = targetId
          ? sanityClient.fetch(`*[${PUBLIC_SIGHTING_FILTER} && _id == $id][0] ${SIGHTING_PROJECTION}`, {id: targetId})
          : Promise.resolve(null)
        const [loadedSightings, targetSighting, loadedRoutes, loadedTerritories] = await Promise.all([
          sanityClient.fetch<SightingFromSanity[]>(`*[${PUBLIC_SIGHTING_FILTER} && defined(location)] ${SIGHTING_PROJECTION}`),
          targetSightingPromise,
          sanityClient.fetch<MapRoute[]>(`*[_type == "route" && defined(slug.current) && !(_id in path("drafts.**"))]{_id,title,slug,city,description,estimatedMinutes,stops[]{note,"sighting":sighting->{title,city,location}}}`),
          sanityClient.fetch<MapTerritory[]>(`*[_type == "territory" && !(_id in path("drafts.**"))]{_id,name,description,area[]{lat,lng},"creature":creature->{_id,name,slug}}`),
        ])
        if (!isMounted) return
        setRoutes(loadedRoutes)
        setTerritories(loadedTerritories)
        loadedSightings.forEach(upsertMarker)
        const located = [...sightingsRef.current.values()].filter((item) => Number.isFinite(item.location?.lat) && Number.isFinite(item.location?.lng))
        if (located.length) {
          const bounds = L.latLngBounds(located.map((item) => [item.location.lat, item.location.lng] as Leaflet.LatLngTuple))
          mapRef.current?.fitBounds(bounds, {padding: [60, 60], maxZoom: 9, animate: false})
        } else {
          mapRef.current?.setView([4.5709, -74.2973], 5, {animate: false})
        }
        if (targetSighting?.location) {
          upsertMarker(targetSighting)
          window.setTimeout(() => {
            const selected = sightingsRef.current.get(targetSighting._id)
            if (selected) focusSighting(selected, 1.25, false)
          }, 180)
        }
        publishSightings()
        setConnectionStatus('live')
      } catch (error) {
        console.error('[Paranormis radar] No se pudieron cargar las señales:', error)
      }
    }

    void import('../lib/sanity').then(({sanityClient}) => {
      if (!isMounted) return
      void loadInitialSightings(sanityClient)
      subscription = sanityClient.listen(`*[${PUBLIC_SIGHTING_FILTER}]`, {}, {tag: 'paranormis-map-live'}).subscribe({
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
        const isNewSignal = Boolean(fresh?.location && !sightingsRef.current.has(fresh._id))
        if (fresh?.location) {
          upsertMarker(fresh)
          if (isNewSignal && update.transition === 'appear') {
            const enriched = {...fresh, entityClass: classForCreatureName(fresh.creature?.name)} as EnrichedSighting
            setLiveSighting(enriched)
            window.setTimeout(() => setLiveSighting((current) => current?._id === enriched._id ? null : current), 5500)
          }
        }
        else removeMarker(update.documentId)
        publishSightings()
      },
      error: (error) => console.error('[Paranormis radar] Error en la conexión en vivo:', error),
      })
    }).catch((error) => console.error('[Paranormis radar] No se pudo conectar con el archivo:', error))

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [focusSighting, publishSightings, mapInstance])

  useEffect(() => {
    const L = leafletRef.current
    if (!mapInstance || !L) return
    const routeLayer = L.layerGroup()
    const territoryLayer = L.layerGroup()
    for (const route of routes) {
      const stops = route.stops.flatMap((stop) => stop.sighting?.location ? [[stop.sighting.location.lat, stop.sighting.location.lng] as Leaflet.LatLngTuple] : [])
      if (stops.length < 2) continue
      L.polyline(stops, {color: '#ffd278', weight: 2.5, opacity: .8, dashArray: '5 7'}).addTo(routeLayer)
      stops.forEach((point, index) => L.circleMarker(point, {radius: 4, color: '#ffd278', weight: 1.5, fillColor: '#090a09', fillOpacity: .95}).bindTooltip(`${index + 1}. ${route.stops[index]?.sighting?.city ?? route.city}`).addTo(routeLayer))
      const first = route.stops.find((stop) => stop.sighting?.location)?.sighting?.location
      if (first) {
        const popup = document.createElement('div')
        const heading = document.createElement('strong')
        heading.textContent = route.title
        const detail = document.createElement('p')
        detail.textContent = `${route.city} · ${stops.length} paradas · ${route.estimatedMinutes} min`
        const link = document.createElement('a')
        link.href = `/rutas/${encodeURIComponent(route.slug.current)}`
        link.textContent = 'Abrir ruta ↗'
        popup.append(heading, detail, link)
        L.circleMarker([first.lat, first.lng], {radius: 8, color: '#ffd278', fillOpacity: .15}).bindPopup(popup).addTo(routeLayer)
      }
    }
    for (const territory of territories) {
      if (territory.area.length < 3) continue
      const polygon = L.polygon(territory.area.map(({lat, lng}) => [lat, lng] as Leaflet.LatLngTuple), {color: '#b6ff52', weight: 1.5, opacity: .32, fillColor: '#a9d88d', fillOpacity: .11, className: 'territory-fog-polygon'})
      const popup = document.createElement('div')
      const heading = document.createElement('strong')
      heading.textContent = territory.name
      const description = document.createElement('p')
      description.textContent = territory.description
      popup.append(heading, description)
      if (territory.creature) {
        const link = document.createElement('a')
        link.href = `/bestiary#${encodeURIComponent(territory.creature._id)}`
        link.textContent = `Ver a ${territory.creature.name} en el bestiario ↗`
        popup.append(link)
      }
      polygon.bindPopup(popup).addTo(territoryLayer)
    }
    routeLayerRef.current = routeLayer
    territoryLayerRef.current = territoryLayer
    if (routesEnabled) routeLayer.addTo(mapInstance)
    if (territoriesEnabled) territoryLayer.addTo(mapInstance)
    return () => {
      routeLayer.remove()
      territoryLayer.remove()
      routeLayerRef.current = null
      territoryLayerRef.current = null
    }
  }, [mapInstance, routes, territories, routesEnabled, territoriesEnabled])

  useEffect(() => {
    if (!selectedSighting) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDossier()
    }
    window.addEventListener('keydown', closeOnEscape)
    dossierRef.current?.focus()
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedSighting, closeDossier])

  useEffect(() => {
    if (!actionsOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionsOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [actionsOpen])

  useEffect(() => {
    if (!actionsOpen) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return
      if (event.target.closest('#map-actions-panel, #map-actions-toggle')) return
      setActionsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress)
  }, [actionsOpen])

  function scanForSignals() {
    const map = mapRef.current
    if (!map || visibleSightings.length === 0) return
    const L = leafletRef.current
    if (!L) return
    setIsScanning(true)
    const bounds = L.latLngBounds(visibleSightings.map((sighting) => [sighting.location.lat, sighting.location.lng] as Leaflet.LatLngTuple))
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
      spatialVoices: new Map(),
      audioBuffers: new Map(),
      audioLoading: new Set(),
    }
    setReceiverOn(true)
  }

  function toggleClass(entityClass: EntityClass) {
    setClassVisibility((current) => ({...current, [entityClass]: !current[entityClass]}))
  }

  function beginSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!window.matchMedia('(max-width: 620px)').matches) return
    sheetDragRef.current = {pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY}
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (sheetDragRef.current?.pointerId === event.pointerId) sheetDragRef.current.lastY = event.clientY
  }

  function endSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = sheetDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const delta = drag.lastY - drag.startY
    if (delta > 70) closeDossier()
    else if (delta < -45) setSheetExpanded(true)
    else if (delta > 35) setSheetExpanded(false)
    sheetDragRef.current = null
  }

  const selectedIndex = selectedSighting ? orderedSightings.findIndex((item) => item._id === selectedSighting._id) : -1
  const previewPoint = previewSighting && mapInstance ? mapInstance.latLngToContainerPoint([previewSighting.location.lat, previewSighting.location.lng]) : null
  const livePoint = liveSighting && mapInstance ? mapInstance.latLngToContainerPoint([liveSighting.location.lat, liveSighting.location.lng]) : null

  return (
    <main className={`bestiary-map-wrap${isGlitching ? ' bestiary-map-wrap--glitch' : ''}${isWitchingHour ? ' bestiary-map-wrap--witching' : ''}`}>
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
          {isWitchingHour && <span className="bestiary-map__witching" aria-label="Hora local entre medianoche y cuatro">✦ Hora bruja</span>}
        </div>
      </div>
      <button className="bestiary-map__tutorial-trigger" type="button" onClick={() => { setTutorialStep(0); setTutorialOpen(true) }} aria-label="Abrir guía del radar">?</button>
      <div ref={mapContainerRef} className="bestiary-map__canvas" />

      {mapInstance && (
        <ParanormalOverlay
          map={mapInstance}
          signals={sightings}
          visibleClasses={visibleClasses}
          selectedSignalId={selectedSighting?._id ?? null}
          previewSignalId={previewSighting?._id ?? null}
          flashlightOn={flashlightOn}
          witchingHour={isWitchingHour}
          receiverActive={receiverOn}
          staticBurst={isGlitching}
          reducedMotion={reducedMotion}
          onSelect={selectSighting}
          onPreview={previewSignal}
          onReveal={onReveal}
          onDismiss={closeDossier}
          onReceiverLevel={onReceiverLevel}
        />
      )}

      {previewSighting && previewPoint && !selectedSighting && <aside className="bestiary-map__preview" style={{left: Math.min(previewPoint.x + 16, window.innerWidth - 250), top: Math.max(96, previewPoint.y - 18)}} aria-live="polite">
        <small>SEÑAL REVELADA</small><strong>{previewSighting.title ?? previewSighting.creature?.name ?? 'Entidad sin clasificar'}</strong><span>{previewSighting.creature?.name ?? 'Fenómeno sin clasificar'} · {previewSighting.city ?? previewSighting.region?.name ?? 'Lugar desconocido'}</span><span>{previewSighting.dateBasis === 'record_date' ? 'Fuente publicada · ' : 'Fecha del relato · '}{formatDate(previewSighting.date)}</span>
        <button type="button" onClick={() => focusSighting(previewSighting)}>Abrir expediente ↗</button>
      </aside>}
      {liveSighting && livePoint && <span className="bestiary-map__live-ping" style={{left: livePoint.x, top: livePoint.y}} aria-hidden="true" />}
      {liveSighting && <aside className="bestiary-map__live-toast" role="status" aria-live="polite"><span>⌁</span><p><strong>Nueva señal detectada</strong><small>{liveSighting.city ?? liveSighting.region?.name ?? 'Sector desconocido'}</small></p><button type="button" onClick={() => focusSighting(liveSighting)}>Ver ↗</button><button type="button" aria-label="Cerrar aviso" onClick={() => setLiveSighting(null)}>×</button></aside>}

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

      {connectionStatus === 'live' && visibleSightings.length === 0 && <section className="bestiary-map__empty" aria-live="polite"><span aria-hidden="true">⌁</span><p>Silencio en este sector…</p><small>Los filtros actuales no muestran señales.</small><button type="button" onClick={() => setClassVisibility({cryptid: true, specter: true, entity: true, anomaly: true})}>Limpiar filtros</button><a href="/report">Reportar un caso ↗</a></section>}

      <div className="bestiary-map__instrument">
        <div className="bestiary-map__compass" aria-hidden="true"><span>N</span><b>✦</b></div>
        <p><span>Posición del cursor</span><strong ref={coordinateReadoutRef}>— / —</strong><small>COORDENADAS GPS</small></p>
        <div className={`bestiary-map__waveform${receiverOn ? ' is-active' : ''}`} aria-label="Monitor de audio EVP">{Array.from({length: 17}, (_, index) => <i key={index} />)}</div>
      </div>

      {yearBounds && activeYearRange && <section className="bestiary-map__timeline" aria-label="Línea de tiempo del archivo">
        <span className="bestiary-map__timeline-label">ARCHIVO CRONOLÓGICO</span>
        <label><span>Desde {activeYearRange[0]}</span><input type="range" min={yearBounds[0]} max={yearBounds[1]} value={activeYearRange[0]} aria-label="Año inicial" onChange={(event) => setYearRange([Math.min(Number(event.currentTarget.value), activeYearRange[1]), activeYearRange[1]])} /></label>
        <label><span>Hasta {activeYearRange[1]}</span><input type="range" min={yearBounds[0]} max={yearBounds[1]} value={activeYearRange[1]} aria-label="Año final" onChange={(event) => setYearRange([activeYearRange[0], Math.max(Number(event.currentTarget.value), activeYearRange[0])])} /></label>
        <span className="bestiary-map__timeline-count">{visibleSightings.length} expedientes</span>
        <button type="button" disabled={visibleSightings.length === 0} aria-pressed={timelinePlaying} onClick={() => { if (timelinePlaying) setTimelinePlaying(false); else { setPlaybackIndex(-1); setTimelinePlaying(true) } }}>{timelinePlaying ? 'Ⅱ Pausar' : '▶ Reproducir'}</button>
      </section>}

      <button className={`bestiary-map__scan ${isScanning ? 'bestiary-map__scan--active' : ''}`} type="button" onClick={scanForSignals} disabled={visibleSightings.length === 0}>
        <span className="bestiary-map__scan-icon" aria-hidden="true">⌁</span>
        {isScanning ? 'Triangulando…' : 'Rastrear señales'}
      </button>
      <button
        id="map-actions-toggle"
        className="bestiary-map__menu-toggle"
        type="button"
        aria-expanded={actionsOpen}
        aria-controls="map-actions-panel"
        aria-label={actionsOpen ? 'Cerrar acciones del mapa' : 'Abrir acciones del mapa'}
        onClick={() => setActionsOpen((open) => !open)}
      >
        <span aria-hidden="true">{actionsOpen ? '×' : '☰'}</span>
      </button>
      <div id="map-actions-panel" className="bestiary-map__explore-controls" data-mobile-open={actionsOpen}>
        <a className="bestiary-map__archive-link" href="/bestiary"><span aria-hidden="true">✦</span> Abrir el archivo <span aria-hidden="true">↗</span></a>
        <a className="bestiary-map__report-link" href="/explorar"><span aria-hidden="true">⌖</span> Buscar por ciudad</a>
        <button type="button" className="bestiary-map__explore" aria-pressed={routesEnabled} onClick={() => setRoutesEnabled((enabled) => !enabled)} disabled={routes.length === 0}><span aria-hidden="true">⌁</span> Rutas · {routesEnabled ? 'activas' : 'inactivas'}</button>
        <button type="button" className="bestiary-map__explore" aria-pressed={territoriesEnabled} onClick={() => setTerritoriesEnabled((enabled) => !enabled)} disabled={territories.length === 0}><span aria-hidden="true">◌</span> Territorios · {territoriesEnabled ? 'activos' : 'inactivos'}</button>
        <button type="button" className="bestiary-map__explore" onClick={() => { discoverRandomSignal(); setActionsOpen(false) }} disabled={visibleSightings.length === 0}>
          <span aria-hidden="true">✦</span> Señal aleatoria
        </button>
        <button type="button" className="bestiary-map__flashlight" onClick={() => { setFlashlightOn((value) => !value); setActionsOpen(false) }} aria-pressed={flashlightOn}>
          <span aria-hidden="true">◉</span> Linterna: {flashlightOn ? 'encendida' : 'apagada'}
        </button>
        <button
          type="button"
          className={`bestiary-map__receiver ${receiverOn ? 'bestiary-map__receiver--on' : ''}`}
          onClick={() => { void toggleReceiver(); setActionsOpen(false) }}
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
        <aside ref={dossierRef} className={`creature-dossier${sheetExpanded ? ' creature-dossier--expanded' : ''}`} aria-label={`Expediente de ${selectedSighting.creature?.name ?? 'entidad sin clasificar'}`} tabIndex={-1}>
          <div className="creature-dossier__toolbar" onPointerDown={beginSheetDrag} onPointerMove={moveSheetDrag} onPointerUp={endSheetDrag} onPointerCancel={endSheetDrag}>
            <span>Expediente del avistamiento</span>
            <div className="creature-dossier__navigation"><button type="button" aria-label="Expediente anterior" disabled={selectedIndex <= 0} onClick={() => focusSighting(orderedSightings[selectedIndex - 1])}>←</button><span>{selectedIndex + 1} / {orderedSightings.length}</span><button type="button" aria-label="Expediente siguiente" disabled={selectedIndex < 0 || selectedIndex >= orderedSightings.length - 1} onClick={() => focusSighting(orderedSightings[selectedIndex + 1])}>→</button></div>
            <button type="button" className="creature-dossier__close" onClick={closeDossier} aria-label="Cerrar expediente"><span aria-hidden="true">×</span> Cerrar</button>
          </div>
          <div className="creature-dossier__image-wrap">
            {illustrationLoading && <div className="creature-dossier__revelation" role="status" aria-live="polite"><span className="creature-dossier__revelation-sigil">✦</span><span>Revelando imagen</span></div>}
            {(selectedSighting.imageUrl || selectedSighting.creature?.imageUrl) ? (
              <img src={selectedSighting.imageUrl ?? selectedSighting.creature?.imageUrl} alt={selectedSighting.imageAlt ?? selectedSighting.creature?.imageAlt ?? `Ilustración de ${selectedSighting.creature?.name ?? 'el avistamiento'}`} className={`creature-dossier__image ${illustrationLoading ? 'creature-dossier__image--loading' : ''}`} onLoad={() => setIllustrationLoading(false)} onError={() => setIllustrationLoading(false)} />
            ) : <div className="creature-dossier__missing-image">?</div>}
            <span className="creature-dossier__stamp">Expediente abierto</span>
          </div>
          <div className="creature-dossier__body">
            <a className="creature-dossier__archive-link" href={casePath(selectedSighting._id)}>Abrir, guardar y compartir expediente ↗</a>
            <p className="creature-dossier__eyebrow">{selectedSighting.region?.country ?? 'Archivo global'} · {dateLabel(selectedSighting.dateBasis)}: {formatDate(selectedSighting.date)}</p>
            <h2>{selectedSighting.creature?.name ?? 'Entidad sin clasificar'}</h2>
            <div className="creature-dossier__badges"><span>{threatLabel(selectedSighting.creature?.threatLevel)}</span><span>{accountLabel(selectedSighting.accountType)}</span><span>Fenómeno: {statusLabel(selectedSighting.status)}</span><span>{selectedSighting.credibilityIndex == null ? 'Credibilidad sin calcular' : `Credibilidad ${selectedSighting.credibilityIndex}%`}</span></div>
            <p className="creature-dossier__location">Reporte situado en <strong>{selectedSighting.region?.name ?? 'región desconocida'}</strong> · {locationLabel(selectedSighting.locationPrecision)}</p>
            {selectedSighting.creature?.physicalDescription && <p className="creature-dossier__description">{selectedSighting.creature.physicalDescription}</p>}
            {selectedSighting.creature?.distinctiveTraits?.length ? <div className="creature-dossier__traits"><p>Rasgos registrados</p>{selectedSighting.creature.distinctiveTraits.slice(0, 5).map((trait) => <span key={trait}>{trait}</span>)}</div> : null}
            <blockquote>{selectedSighting.freeformDescription}</blockquote>
            {selectedSighting.sourceUrl && selectedSighting.sourceTitle && <p className="creature-dossier__origin"><strong>Fuente documentada:</strong> <a href={selectedSighting.sourceUrl} target="_blank" rel="noopener noreferrer">{selectedSighting.sourceTitle} ↗</a>. Esta referencia documenta el relato; no confirma por sí sola el fenómeno.</p>}
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
      {tutorialOpen && <div className="map-tutorial-backdrop" role="presentation" onClick={finishTutorial}><section className="map-tutorial" role="dialog" aria-modal="true" aria-labelledby="map-tutorial-title" onClick={(event) => event.stopPropagation()}>
        <span className="map-tutorial__kicker">GUÍA DE CAMPO · {tutorialStep + 1} / 3</span><h2 id="map-tutorial-title">{tutorialSteps[tutorialStep].title}</h2><p>{tutorialSteps[tutorialStep].copy}</p><div><button type="button" onClick={finishTutorial}>Saltar guía</button>{tutorialStep < tutorialSteps.length - 1 ? <button type="button" onClick={() => setTutorialStep((step) => step + 1)}>Siguiente →</button> : <button type="button" onClick={finishTutorial}>Comenzar</button>}</div>
      </section></div>}
    </main>
  )
}







