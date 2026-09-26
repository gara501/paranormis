// Application publication filter. Private editorial work belongs in Sanity drafts.
export const PUBLIC_SIGHTING_FILTER = '_type == "sighting" && editorialApproved == true && !(_id in path("drafts.**"))'
export interface EditorialCase {
  _id: string
  title: string
  city?: string
  date: string
  dateBasis?: string
  dateNotes?: string
  locationPrecision?: string
  location?: {lat: number; lng: number}
  freeformDescription: string
  sourceTitle?: string
  sourceUrl?: string
  additionalSources?: {title: string; url: string}[]
  narrative?: string
  status?: string
  creature?: {name: string; imageUrl?: string} | null
  region?: {name: string; country?: string} | null
}
export const CASE_PROJECTION = `{
  _id, "title": coalesce(title, creature->name, "Expediente"), city, date, dateBasis, dateNotes,
  locationPrecision, location, freeformDescription, sourceTitle, sourceUrl,
  additionalSources[]{title,url}, narrative, status,
  "creature": creature->{name,"imageUrl":archiveIllustration.asset->url},
  "region": region->{name,country}
}`
export const CASES_QUERY = `*[${PUBLIC_SIGHTING_FILTER}] | order(date desc) ${CASE_PROJECTION}`
export const CASE_QUERY = `*[${PUBLIC_SIGHTING_FILTER} && _id == $id][0] ${CASE_PROJECTION}`
export function caseDate(item: Pick<EditorialCase, 'date' | 'dateBasis'>): string {
  const date = new Date(item.date)
  if (Number.isNaN(date.getTime())) return 'Fecha no precisada'
  const prefix = item.dateBasis === 'record_date' ? 'Fuente publicada: ' : item.dateBasis === 'approximate_event' ? 'Periodo aproximado: ' : 'Fecha del relato: '
  return prefix + date.toLocaleDateString('es-CO', {year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Bogota'})
}
export const casePath = (id: string) => `/expedientes/${encodeURIComponent(id)}`
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
}
