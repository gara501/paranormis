import {useMemo, useState} from 'react'
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
  if (!primary.location) return <div className="connection-board__no-map">Este reporte no tiene coordenadas.</div>
  const points = [{id: primary._id, lat: primary.location.lat, lng: primary.location.lng, kind: 'source' as const}, ...links.flatMap((link) => link.sighting.location ? [{id: link.sighting._id, lat: link.sighting.location.lat, lng: link.sighting.location.lng, kind: link.kind}] : [])]
  const centerLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length
  const adjusted = points.map((point) => ({...point, x: point.lng * Math.cos(centerLat * Math.PI / 180), y: point.lat}))
  const minX = Math.min(...adjusted.map((point) => point.x)), maxX = Math.max(...adjusted.map((point) => point.x))
  const minY = Math.min(...adjusted.map((point) => point.y)), maxY = Math.max(...adjusted.map((point) => point.y))
  const spanX = Math.max(maxX - minX, .04), spanY = Math.max(maxY - minY, .04)
  const position = (point: typeof adjusted[number]) => ({x: 70 + ((point.x - minX) / spanX) * 860, y: 45 + ((maxY - point.y) / spanY) * 300})
  const source = position(adjusted[0])
  return <div className="connection-board__map" role="group" aria-label={`Diagrama de ${links.length} reporte${links.length === 1 ? '' : 's'} relacionado${links.length === 1 ? '' : 's'}`}>
    <svg viewBox="0 0 1000 390" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {adjusted.slice(1).map((point) => { const target = position(point); const link = links.find((item) => item.sighting._id === point.id); return <line key={`line-${point.id}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} className={`connection-map-line connection-map-line--${link?.kind ?? 'possible'}`} /> })}
      {adjusted.map((point) => { const coords = position(point); const active = point.id === selectedId; const label = point.kind === 'source' ? 'Reporte seleccionado' : links.find((link) => link.sighting._id === point.id)?.sighting.region?.name ?? 'Reporte relacionado'; return <g key={point.id} className={`connection-map-node connection-map-node--${point.kind}${active ? ' is-selected' : ''}`} transform={`translate(${coords.x} ${coords.y})`} role={point.kind === 'source' ? undefined : 'button'} tabIndex={point.kind === 'source' ? undefined : 0} aria-label={label} onClick={point.kind === 'source' ? undefined : () => onSelect(point.id)} onKeyDown={point.kind === 'source' ? undefined : (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(point.id) } }}><circle r={point.kind === 'source' ? 15 : 10} /><title>{label}</title>{point.kind === 'source' && <text textAnchor="middle" dy=".36em">✦</text>}</g> })}
    </svg>
    <span className="connection-board__map-credit">Proyección geográfica aproximada · sin mapa base</span>
  </div>
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








