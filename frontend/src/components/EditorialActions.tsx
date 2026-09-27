import {useEffect,useState} from 'react'
import {FAVORITES_KEY,readFavorites} from './CaseActions'
export default function EditorialActions({id,title,href}:{id:string;title:string;href:string}){
 const [saved,setSaved]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{const sync=()=>setSaved(readFavorites().includes(id));sync();window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[id])
 async function share(){const url=new URL(href,location.origin).href;try{if(navigator.share)await navigator.share({title:`${title} — Paranormis`,text:'Consulta este registro del archivo Paranormis.',url});else{await navigator.clipboard.writeText(url);setMessage('Enlace copiado.')}}catch(e){if(e instanceof Error&&e.name!=='AbortError')setMessage('No se pudo compartir el enlace.')}}
 function save(){try{const ids=readFavorites(),next=ids.includes(id)?ids.filter(x=>x!==id):[id,...ids].slice(0,500);localStorage.setItem(FAVORITES_KEY,JSON.stringify(next));setSaved(next.includes(id));setMessage(next.includes(id)?'Guardado en este dispositivo.':'Eliminado de tus guardados.')}catch{setMessage('No se pudo guardar en este dispositivo.')}}
 return <div className="editorial-actions"><button type="button" aria-pressed={saved} onClick={save}>{saved?'★ Guardado':'☆ Guardar en favoritos'}</button><button type="button" onClick={share}>Compartir enlace ↗</button><span role="status" className="editorial-note">{message}</span></div>
}
