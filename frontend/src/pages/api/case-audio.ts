import type {APIRoute} from 'astro'
import {sanityClient} from '../../lib/sanity'
import {CASE_QUERY, type EditorialCase} from '../../lib/editorial'

export const prerender = false

export const GET: APIRoute = async ({params, url}) => {
  const id = url.searchParams.get('id')
  if (!id || id.length > 128) return new Response(null, {status: 400})
  try {
    const record = await sanityClient.fetch<Pick<EditorialCase, 'audioUrl'> | null>(CASE_QUERY, {id})
    if (!record) return new Response(null, {status: 404, headers: {'Cache-Control': 'no-store'}})
    return Response.json({audioUrl: record.audioUrl ?? null}, {headers: {'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'}})
  } catch {
    return new Response(null, {status: 503, headers: {'Cache-Control': 'no-store'}})
  }
}
