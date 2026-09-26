import {useEffect, useMemo, useRef, useState} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {distanceKm} from '../lib/calculateCredibility'
import type {FieldSighting} from './CreatureArchive'
import './ConnectionBoard.css'
import '../styles/paranormis.css'

interface Connection {
  sighting: FieldSighting
  kind: 'registered' | 'possible'
  distance: number | null
  days: number | null
  commonTraits: string[]
}

function normalize(value: string) { return value.trim().toLocaleLowerCase() }

function daysBetween(a?: string, b?: string) {
  if (!a || !b) return null
  const diff = Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000
  return Number.isFinite(diff) ? Math.round(diff) : null
}

function dateLabel(value?: string) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-ES', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(date)
}

function buildConnections(primary: FieldSighting, sightings: FieldSighting[]): Connection[] {
  const direct = new Set(primary.corroboratedBy?.map((reference) => reference._ref) ?? [])
  const primaryTraits = new Set((primary.observedTraits ?? []).map(normalize))

  return sightings.flatMap((other) => {
    if (other._id === primary._id) return []
    const registered = direct.has(other._id) || (other.corroboratedBy ?? []).some((reference) => reference._ref === primary._id)
    const distance = primary.location && other.location ? distanceKm(primary.location, other.location) : null
    const days = daysBetween(primary.date, other.date)
    const commonTraits = [...new Set(other.observedTraits ?? [])].filter((trait) => primaryTraits.has(normalize(trait)))
    const possible = other.creatureId === primary.creatureId && distance !== null && distance <= 100 && days !== null && days <= 365 && commonTraits.length > 0
    return registered || possible ? [{sighting: other, kind: registered ? 'registered' : 'possible', distance, days, commonTraits} as Connection] : []
  }).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'registered' ? -1 : 1
    return b.commonTraits.length - a.commonTraits.length || (a.distance ?? Infinity) - (b.distance ?? Infinity)
  })
}

function ConnectionMap({primary, links, selectedId, onSelect}: {primary: FieldSighting; links: Connection[]; selectedId?: string; onSelect: (id: string) => void}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, {zoomControl: false, scrollWheelZoom: false, dragging: true, attributionControl: true})
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
      crossOrigin: true,
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    return () => { map.remove(); mapRef.current = null; layerRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer || !primary.location) return
    layer.clearLayers()
    const source: L.LatLngExpression = [primary.location.lat, primary.location.lng]
    const bounds: L.LatLngExpression[] = [source]
    links.forEach((link) => {
      if (!link.sighting.location) return
      const target: L.LatLngExpression = [link.sighting.location.lat, link.sighting.location.lng]
      bounds.push(target)
      L.polyline([source, target], {color: link.kind === 'registered' ? '#42e8ff' : '#b6ff52', weight: link.sighting._id === selectedId ? 3 : 1.5, opacity: link.sighting._id === selectedId ? .95 : .58, dashArray: link.kind === 'possible' ? '6 7' : undefined}).addTo(layer)
      const icon = L.divIcon({className: '', html: `<span class="connection-pin connection-pin--${link.kind}${link.sighting._id === selectedId ? ' connection-pin--selected' : ''}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11]})
      L.marker(target, {icon, title: link.sighting.region?.name ?? 'Reporte relacionado'}).on('click', () => onSelect(link.sighting._id)).addTo(layer)
    })
    const sourceIcon = L.divIcon({className: '', html: '<span class="connection-pin connection-pin--source">✦</span>', iconSize: [30, 30], iconAnchor: [15, 15]})
    L.marker(source, {icon: sourceIcon, title: 'Reporte seleccionado'}).addTo(layer)
    if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds as L.LatLngTuple[]), {padding: [65, 65], maxZoom: 12, animate: false})
    else map.setView(source, 7, {animate: false})
  }, [primary, links, selectedId, onSelect])

  return <div ref={containerRef} className="connection-board__map" role="img" aria-label={`Mapa de ${links.length} reporte${links.length === 1 ? '' : 's'} relacionado${links.length === 1 ? '' : 's'}`} />
}

export default function ConnectionBoard({sighting, sightings, creatureName, onOpenSighting}: {sighting: FieldSighting; sightings: FieldSighting[]; creatureName: string; onOpenSighting: (id: string) => void}) {
  const [selectedId, setSelectedId] = useState('')
  const links = useMemo(() => buildConnections(sighting, sightings), [sighting, sightings])
  const selected = links.find((link) => link.sighting._id === selectedId) ?? links[0]
  const registeredCount = links.filter((link) => link.kind === 'registered').length
  const possibleCount = links.length - registeredCount

  return (
    <section className="connection-board" aria-labelledby="connection-board-title">
      <div className="connection-board__heading">
        <div><span className="connection-board__kicker">05 / MAPA DE CONEXIONES</span><h3 id="connection-board-title">Sigue los rastros.</h3><p>Reportes relacionados con este caso, ubicados según evidencia y localización.</p></div>
        <div className="connection-board__counts"><span>{registeredCount} <small>VÍNCULOS CONFIRMADOS</small></span><span>{possibleCount} <small>COINCIDENCIAS POSIBLES</small></span></div>
      </div>
      <div className="connection-board__workspace">
        <div className="connection-board__map-shell">
          {sighting.location ? <ConnectionMap primary={sighting} links={links} selectedId={selected?.sighting._id} onSelect={setSelectedId} /> : <div className="connection-board__no-map">Este reporte no tiene coordenadas.</div>}
          <div className="connection-board__map-label">COORDENADAS / {sighting.location ? `${sighting.location.lat.toFixed(2)}°, ${sighting.location.lng.toFixed(2)}°` : 'NO DISPONIBLES'}</div>
          <div className="connection-board__legend"><span><i className="connection-board__key--source" /> Reporte seleccionado</span><span><i className="connection-board__key--registered" /> Vínculo confirmado</span><span><i className="connection-board__key--possible" /> Coincidencia posible</span></div>
        </div>
        <aside className="connection-board__index" aria-label="Reportes relacionados">
          <p className="connection-board__index-label">CONEXIONES DETECTADAS <strong>{String(links.length).padStart(2, '0')}</strong></p>
          {links.length === 0 ? <div className="connection-board__empty"><span aria-hidden="true">⌁</span><p>No se encontraron reportes cercanos o relacionados con este caso.</p></div> : links.map((link) => <button key={link.sighting._id} type="button" className={`connection-board__item ${selected?.sighting._id === link.sighting._id ? 'is-active' : ''}`} onClick={() => setSelectedId(link.sighting._id)} aria-pressed={selected?.sighting._id === link.sighting._id}>
            <span className={`connection-board__item-mark connection-board__item-mark--${link.kind}`} aria-hidden="true" />
            <span><small>{link.kind === 'registered' ? 'VÍNCULO CONFIRMADO' : 'COINCIDENCIA POSIBLE'} · {dateLabel(link.sighting.date)}</small><strong>{link.sighting.region?.name ?? 'Región sin confirmar'}</strong><em>{link.commonTraits.length} {link.commonTraits.length === 1 ? 'rasgo en común' : 'rasgos en común'} · {link.distance === null ? 'distancia desconocida' : `${Math.round(link.distance)} km de distancia`}</em></span>
            <span aria-hidden="true">↗</span>
          </button>)}
        </aside>
      </div>
      {selected && <div className="connection-board__compare">
        <div className="connection-board__case"><span>01 / REPORTE ACTUAL</span><strong>{sighting.region?.name ?? 'Región sin confirmar'}</strong><small>{dateLabel(sighting.date)} · {creatureName}</small></div>
        <div className="connection-board__bridge"><span className="connection-board__bridge-line" aria-hidden="true" /><strong>{selected.kind === 'registered' ? 'CORROBORACIÓN REGISTRADA' : 'POSIBLE RELACIÓN'}</strong><span>{selected.days === null ? 'Intervalo desconocido' : `${selected.days} día${selected.days === 1 ? '' : 's'} de diferencia`} · {selected.distance === null ? 'distancia desconocida' : `${Math.round(selected.distance)} km de distancia`}</span><span className="connection-board__bridge-line" aria-hidden="true" /></div>
        <div className="connection-board__case"><span>02 / REPORTE RELACIONADO</span><strong>{selected.sighting.region?.name ?? 'Región sin confirmar'}</strong><small>{dateLabel(selected.sighting.date)} · Credibilidad {selected.sighting.credibilityIndex == null ? 'pendiente' : `${Math.round(selected.sighting.credibilityIndex)}/100`}</small></div>
        <div className="connection-board__shared"><span>OBSERVACIONES EN COMÚN</span><p>{selected.commonTraits.length ? selected.commonTraits.join(' · ') : 'No hay rasgos coincidentes.'}</p><button type="button" onClick={() => onOpenSighting(selected.sighting._id)}>Abrir reporte relacionado ↗</button></div>
      </div>}
      <p className="connection-board__method">Los vínculos confirmados provienen de referencias directas entre casos. Las coincidencias posibles comparten entidad y al menos un rasgo observado, con reportes a menos de 100 km y 365 días. Cada coincidencia requiere revisión.</p>
    </section>
  )
}








