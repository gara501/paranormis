import type {APIRoute} from 'astro'
import {sanityClient} from '../../lib/sanity'
import {sanityWriteClient} from '../../lib/sanityWriteClient'
import {calculateCredibilityIndex, distanceKm, GROQ_SIGHTINGS_SAME_CREATURE} from '../../lib/calculateCredibility'

export const prerender = false

interface SubmitBody {
  creatureId: string
  regionId: string
  location: {lat: number; lng: number}
  witness: {
    anonymous: boolean
    name?: string
    occupation?: string
    baseCredibility: number
    witnessState: string
  }
  date: string
  timeOfDay: string
  freeformDescription: string
  observedTraits: string[]
  environmentalConditions: {
    moonPhase?: string
    weather?: string
    visibility?: string
  }
}

const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/webm',
])

export const POST: APIRoute = async ({request}) => {
  try {
    const formData = await request.formData()
    const rawPayload = formData.get('payload')
    if (typeof rawPayload !== 'string') {
      return new Response(JSON.stringify({error: 'Falta el contenido del reporte'}), {status: 400})
    }
    const body: SubmitBody = JSON.parse(rawPayload)
    const audioEntry = formData.get('testimonyAudio')
    const testimonyAudio = audioEntry && typeof audioEntry !== 'string' ? audioEntry : null

    if (!body.creatureId || !body.regionId || !body.location || !body.freeformDescription) {
      return new Response(
        JSON.stringify({error: 'Faltan campos requeridos: entidad, región, ubicación o relato'}),
        {status: 400},
      )
    }

    if (testimonyAudio && (!ALLOWED_AUDIO_TYPES.has(testimonyAudio.type) || testimonyAudio.size > MAX_AUDIO_BYTES)) {
      return new Response(
        JSON.stringify({error: 'El audio debe ser MP3, WAV, OGG, M4A o WebM y no superar 8 MB.'}),
        {status: 400},
      )
    }

    const audioAsset = testimonyAudio
      ? await sanityWriteClient.assets.upload('file', Buffer.from(await testimonyAudio.arrayBuffer()), {
          filename: testimonyAudio.name,
          contentType: testimonyAudio.type,
        })
      : null

    // 1. Create the sighting document, status starts as "pending"
    const created = await sanityWriteClient.create({
      _type: 'sighting',
      creature: {_type: 'reference', _ref: body.creatureId},
      region: {_type: 'reference', _ref: body.regionId},
      location: {_type: 'geopoint', lat: body.location.lat, lng: body.location.lng},
      witness: {
        anonymous: body.witness?.anonymous ?? true,
        name: body.witness?.anonymous ? undefined : body.witness?.name,
        occupation: body.witness?.occupation,
        baseCredibility: body.witness?.baseCredibility ?? 3,
        witnessState: body.witness?.witnessState ?? 'unspecified',
      },
      date: body.date,
      timeOfDay: body.timeOfDay,
      freeformDescription: body.freeformDescription,
      testimonyAudio: audioAsset
        ? {_type: 'file', asset: {_type: 'reference', _ref: audioAsset._id}}
        : undefined,
      observedTraits: body.observedTraits ?? [],
      environmentalConditions: body.environmentalConditions ?? {},
      status: 'pending',
    })

    // 2. Fetch the creature + region data needed for the calculation
    const creature = await sanityClient.fetch(`*[_type == "creature" && _id == $id][0]{distinctiveTraits}`, {
      id: body.creatureId,
    })
    const region = await sanityClient.fetch(`*[_type == "region" && _id == $id][0]{centuriesOfTradition}`, {
      id: body.regionId,
    })

    // 3. Fetch nearby sightings of the same creature for corroboration
    const rawNearby = await sanityClient.fetch(GROQ_SIGHTINGS_SAME_CREATURE, {
      creatureId: body.creatureId,
      currentSightingId: created._id,
    })
    const nearbySightings = rawNearby
      .filter((s: any) => s.location)
      .map((s: any) => ({
        _id: s._id,
        observedTraits: s.observedTraits ?? [],
        date: s.date,
        distanceKm: distanceKm(body.location, s.location),
      }))

    // 4. Calculate and patch back
    const credibilityIndex = calculateCredibilityIndex({
      sighting: {
        _id: created._id,
        observedTraits: body.observedTraits ?? [],
        environmentalConditions: body.environmentalConditions,
        witness: {
          baseCredibility: body.witness?.baseCredibility ?? 3,
          witnessState: (body.witness?.witnessState ?? 'unspecified') as any,
        },
        location: body.location,
        date: body.date,
      },
      creature: {distinctiveTraits: creature?.distinctiveTraits ?? []},
      region: {centuriesOfTradition: region?.centuriesOfTradition ?? 0},
      nearbySightings,
    })

    await sanityWriteClient.patch(created._id).set({credibilityIndex}).commit()

    return new Response(JSON.stringify({sightingId: created._id, credibilityIndex}), {
      status: 201,
      headers: {'Content-Type': 'application/json'},
    })
  } catch (error) {
    console.error('Error submitting sighting:', error)
    return new Response(JSON.stringify({error: 'Error interno del servidor'}), {status: 500})
  }
}

