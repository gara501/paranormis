import type {APIRoute} from 'astro'
export const prerender = false
export const ALL: APIRoute = () => new Response(JSON.stringify({error: 'La edición de expedientes está reservada al equipo editorial.'}), {
  status: 410,
  headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'},
})
