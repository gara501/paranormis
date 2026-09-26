import {useEffect, useState} from 'react'
export const FAVORITES_KEY = 'paranormis:expedientes:v1'
export function readFavorites(): string[] {
  try { const data=JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); return Array.isArray(data) ? data.filter((id): id is string=>typeof id==='string').slice(0,500) : [] } catch { return [] }
}
export default function CaseActions({id,title,text}:{id:string;title:string;text:string}) {
  const [saved,setSaved]=useState(false)
  const [message,setMessage]=useState('')
  const [speaking,setSpeaking]=useState(false)
  const [audio,setAudio]=useState(false)
  useEffect(()=>{
    const sync=()=>setSaved(readFavorites().includes(id))
    sync(); setAudio('speechSynthesis' in window)
    window.addEventListener('storage',sync)
    const stop=()=>{ if(document.hidden) {window.speechSynthesis?.cancel();setSpeaking(false)} }
    document.addEventListener('visibilitychange',stop)
    return ()=>{window.removeEventListener('storage',sync);document.removeEventListener('visibilitychange',stop);window.speechSynthesis?.cancel()}
  },[id])
  function save() {
    try {const ids=readFavorites(); const next=ids.includes(id)?ids.filter(x=>x!==id):[id,...ids].slice(0,500); localStorage.setItem(FAVORITES_KEY,JSON.stringify(next));setSaved(next.includes(id));setMessage(next.includes(id)?'Guardado en este dispositivo.':'Eliminado de tus guardados.')} catch {setMessage('El navegador no permite guardar en este dispositivo.')}
  }
  async function share() {
    const data={title,text:'Un expediente de Paranormis con sus fuentes.',url:new URL(`/expedientes/${encodeURIComponent(id)}`,window.location.origin).href}
    try {if(navigator.share) await navigator.share(data); else {await navigator.clipboard.writeText(data.url);setMessage('Enlace copiado.')}} catch(e) {if(e instanceof Error && e.name!=='AbortError') setMessage('Copia el enlace desde la barra de direcciones.')}
  }
  function narrate() {
    window.speechSynthesis.cancel()
    if(speaking) {setSpeaking(false);return}
    const utterance=new SpeechSynthesisUtterance(`${title}. ${text}`)
    utterance.lang='es-CO';utterance.rate=0.93
    utterance.onend=()=>setSpeaking(false)
    utterance.onerror=()=>{setSpeaking(false);setMessage('No se pudo reproducir la voz. Puedes leer la transcripción.')}
    setSpeaking(true);window.speechSynthesis.speak(utterance)
  }
  return <div className="case-tools"><div className="editorial-actions">
    <button type="button" onClick={save} aria-pressed={saved}>{saved?'★ Guardado':'☆ Guardar expediente'}</button>
    <button type="button" onClick={share}>Compartir enlace ↗</button>
    <a href={`/tarjetas/${encodeURIComponent(id)}.png?download=1`}>Descargar tarjeta</a>
    {audio && <button type="button" onClick={narrate} aria-pressed={speaking}>{speaking?'■ Detener lectura':'▷ Escuchar relato'}</button>}
  </div><p className="editorial-note">Favoritos locales · Lectura opcional con la voz del dispositivo.</p><p role="status" className="editorial-note">{message}</p></div>
}
