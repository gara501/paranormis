import type {APIRoute} from 'astro'
import {sanityClient} from '../../lib/sanity'
import {sanityWriteClient} from '../../lib/sanityWriteClient'
import {calculateCredibilityIndex, distanceKm, GROQ_SIGHTINGS_SAME_CREATURE} from '../../lib/calculateCredibility'

export const prerender = false // this route must run on the server, not be static

interface RequestBody {
  sightingId: string
}

export const POST: APIRoute = async ({request}) => {
  try {
    const {sightingId}: RequestBody = await request.json()

    if (!sightingId) {
      return new Response(JSON.stringify({error: 'se requiere sightingId'}), {status: 400})
    }

    // 1. Fetch the sighting plus its creature and region in one GROQ query
    const sighting = await sanityClient.fetch(
      `*[_type == "sighting" && _id == $sightingId][0]{
        _id,
        observedTraits,
        environmentalConditions,
        witness,
        location,
        date,
        "creatureRef": creature._ref,
        "creature": creature->{distinctiveTraits},
        "region": region->{centuriesOfTradition}
      }`,
      {sightingId},
    )

    if (!sighting) {
      return new Response(JSON.stringify({error: 'No se encontró el reporte'}), {status: 404})
    }

    // 2. Fetch other sightings of the same creature, to check corroboration
    const rawNearby = await sanityClient.fetch(GROQ_SIGHTINGS_SAME_CREATURE, {
      creatureId: sighting.creatureRef,
      currentSightingId: sighting._id,
    })

    const nearbySightings = rawNearby
      .filter((s: any) => s.location) // skip anything missing coordinates
      .map((s: any) => ({
        _id: s._id,
        observedTraits: s.observedTraits ?? [],
        date: s.date,
        distanceKm: distanceKm(sighting.location, s.location),
      }))

    // 3. Run the calculation
    const credibilityIndex = calculateCredibilityIndex({
      sighting: {
        _id: sighting._id,
        observedTraits: sighting.observedTraits ?? [],
        environmentalConditions: sighting.environmentalConditions,
        witness: sighting.witness,
        location: sighting.location,
        date: sighting.date,
      },
      creature: {distinctiveTraits: sighting.creature?.distinctiveTraits ?? []},
      region: {centuriesOfTradition: sighting.region?.centuriesOfTradition ?? 0},
      nearbySightings,
    })

    // 4. Patch the result back onto the sighting document
    await sanityWriteClient.patch(sighting._id).set({credibilityIndex}).commit()

    return new Response(JSON.stringify({sightingId: sighting._id, credibilityIndex}), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    })
  } catch (error) {
    console.error('Error calculating credibility index:', error)
    return new Response(JSON.stringify({error: 'Error interno del servidor'}), {status: 500})
  }
}

