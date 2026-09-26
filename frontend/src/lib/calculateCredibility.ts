/**
 * Calculates a sighting's credibility index (0-100) by cross-referencing
 * several signals from the structured schema. This logic is the reason the
 * content needs to be modeled this way: a free-text search over the
 * "witness account" could never produce this number.
 *
 * Runs as a Sanity Function (on document publish/update) or from the
 * App SDK when a sighting is created/edited.
 */

type MoonPhase = 'new' | 'waxing' | 'full' | 'waning' | 'unknown'
type Weather = 'clear' | 'fog' | 'storm' | 'light_rain' | 'snow'
type Visibility = 'good' | 'fair' | 'poor'
type WitnessState = 'sober' | 'stressed' | 'impaired' | 'unspecified'

interface Sighting {
  _id: string
  observedTraits: string[]
  environmentalConditions?: {
    moonPhase?: MoonPhase
    weather?: Weather
    visibility?: Visibility
  }
  witness: {
    baseCredibility: number // 1-5
    witnessState: WitnessState
  }
  location: {lat: number; lng: number}
  date: string // ISO
  corroboratedBy?: {_ref: string}[]
}

interface Creature {
  distinctiveTraits: string[]
}

interface Region {
  centuriesOfTradition: number
}

interface NearbySighting {
  _id: string
  observedTraits: string[]
  date: string
  distanceKm: number
}

const WEIGHTS = {
  traitConsistency: 0.3,
  witnessCredibility: 0.2,
  witnessState: 0.1,
  corroboration: 0.25,
  folkloreDensity: 0.15,
}

/** Haversine distance in km between two points. */
function distanceKm(a: {lat: number; lng: number}, b: {lat: number; lng: number}): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** % of observed traits that match the creature's canonical traits. */
function traitConsistency(observed: string[], canonical: string[]): number {
  if (observed.length === 0 || canonical.length === 0) return 0
  const canonicalNorm = canonical.map((t) => t.toLowerCase().trim())
  const matches = observed.filter((t) => canonicalNorm.includes(t.toLowerCase().trim()))
  return matches.length / canonical.length // 0-1
}

/** Penalizes or favors credibility based on the witness's state. */
function witnessStateFactor(state: WitnessState): number {
  switch (state) {
    case 'sober':
      return 1
    case 'stressed':
      return 0.75 // fear distorts perception but doesn't invalidate it
    case 'impaired':
      return 0.35
    default:
      return 0.6
  }
}

/**
 * Looks at other sightings of the same creature within a reasonable radius
 * and time window, and measures how similar their observed traits are.
 * (The actual "nearby" lookup is done via GROQ before calling this function;
 * this only processes the result.)
 */
function corroborationFactor(
  current: Sighting,
  nearby: NearbySighting[],
  maxRadiusKm = 50,
  maxDays = 365,
): number {
  if (nearby.length === 0) return 0

  const currentDate = new Date(current.date).getTime()
  let score = 0

  for (const other of nearby) {
    if (other.distanceKm > maxRadiusKm) continue
    const dayDiff = Math.abs(currentDate - new Date(other.date).getTime()) / 86_400_000
    if (dayDiff > maxDays) continue

    const overlap = traitConsistency(current.observedTraits, other.observedTraits)
    // closer in space/time and more shared traits = more weight
    const distanceWeight = 1 - other.distanceKm / maxRadiusKm
    const timeWeight = 1 - dayDiff / maxDays
    score += overlap * distanceWeight * timeWeight
  }

  return Math.min(score / Math.max(nearby.length, 1), 1) // normalized 0-1
}

/**
 * Folklore density: a region with centuries of tradition doesn't "prove"
 * anything on its own, but it's a legitimate signal — hence the relatively
 * low weight.
 */
function folkloreDensityFactor(centuriesOfTradition: number): number {
  return Math.min(centuriesOfTradition / 5, 1) // saturates at 1 past 5 centuries
}

export function calculateCredibilityIndex(params: {
  sighting: Sighting
  creature: Creature
  region: Region
  nearbySightings: NearbySighting[]
}): number {
  const {sighting, creature, region, nearbySightings} = params

  const consistency = traitConsistency(sighting.observedTraits, creature.distinctiveTraits)
  const witnessCredibility = sighting.witness.baseCredibility / 5 // 0-1
  const stateFactor = witnessStateFactor(sighting.witness.witnessState)
  const corroboration = corroborationFactor(sighting, nearbySightings)
  const folkloreDensity = folkloreDensityFactor(region.centuriesOfTradition)

  const rawScore =
    consistency * WEIGHTS.traitConsistency +
    witnessCredibility * WEIGHTS.witnessCredibility +
    stateFactor * WEIGHTS.witnessState +
    corroboration * WEIGHTS.corroboration +
    folkloreDensity * WEIGHTS.folkloreDensity

  return Math.round(rawScore * 100) // 0-100
}

/**
 * Reference GROQ query to fetch "nearby" sightings before calling
 * calculateCredibilityIndex. Adjust the radius by filtering in memory with
 * distanceKm, since GROQ has no native geo-radius filter without a geo
 * queries plugin.
 */
export const GROQ_SIGHTINGS_SAME_CREATURE = /* groq */ `
*[_type == "sighting" && creature._ref == $creatureId && _id != $currentSightingId]{
  _id,
  observedTraits,
  date,
  location
}
`

export {distanceKm}
