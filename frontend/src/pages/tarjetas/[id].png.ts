import type {APIRoute} from 'astro'
import sharp from 'sharp'
import {sanityClient} from '../../lib/sanity'
import {CASE_QUERY,type EditorialCase} from '../../lib/editorial'
export const prerender=false
const escape=(value:string)=>value.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!))
function lines(value:string,max=31):string[] {
  const result:string[]=[]
  for(const word of value.slice(0,120).split(/\s+/)) {
    if(!result.length||(result[result.length-1]+' '+word).length>max) result.push(word)
    else result[result.length-1]+=' '+word
  }
  return result.slice(0,4)
}
export const GET:APIRoute=async({params,url})=>{
  try {
    const item=await sanityClient.fetch<EditorialCase|null>(CASE_QUERY,{id:params.id})
    if(!item) return new Response('Expediente no disponible',{status:404,headers:{'Cache-Control':'no-store'}})
    const heading=lines(item.title).map((line,i)=>`<text x="72" y="${235+i*63}" font-size="51" font-family="serif" font-weight="bold" fill="#eeeae0">${escape(line)}</text>`).join('')
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#24251f" stroke-width="1"/></pattern></defs><rect width="1200" height="630" fill="#090b09"/><rect x="790" width="410" height="630" fill="url(#grid)"/><g stroke="#4b4435" fill="none"><circle cx="1080" cy="330" r="220"/><circle cx="1080" cy="330" r="140"/><circle cx="1080" cy="330" r="55"/></g><circle cx="1080" cy="330" r="8" fill="#d63b35"/><path d="M72 135H1128" stroke="#3b392f"/><text x="72" y="84" font-family="monospace" font-size="24" letter-spacing="5" fill="#eeeae0">PARANORMIS</text><text x="1128" y="84" text-anchor="end" font-family="monospace" font-size="18" fill="#b5af9f">ARCHIVO / COLOMBIA</text>${heading}<rect x="72" y="507" width="4" height="48" fill="#d63b35"/><text x="95" y="524" font-family="monospace" font-size="20" fill="#eeeae0">${escape((item.city||item.region?.name||'Archivo').slice(0,50))}</text><text x="95" y="554" font-family="monospace" font-size="16" fill="#b5af9f">TESTIMONIO PUBLICADO · CONSULTA SUS FUENTES</text></svg>`
    const png=await sharp(Buffer.from(svg)).png().toBuffer()
    return new Response(new Uint8Array(png),{headers:{'Content-Type':'image/png','Cache-Control':'no-store',...(url.searchParams.has('download')?{'Content-Disposition':'attachment; filename="paranormis-expediente.png"'}:{})}})
  }catch{return new Response('No se pudo generar la tarjeta',{status:503,headers:{'Cache-Control':'no-store'}})}
}
