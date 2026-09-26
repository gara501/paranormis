import type {APIRoute} from 'astro'
export const prerender = false
// Reject before reading a body, uploading assets, or importing any write client.
export const ALL: APIRoute = () => new Response(JSON.stringify({error: 'Paranormis es un archivo editorial. Los aportes públicos están deshabilitados.'}), {
  status: 410,
  headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'},
})
