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
  const [audioUrl,setAudioUrl]=useState<string>()
  const [place,setPlace]=useState('Archivo de Colombia')
  useEffect(()=>{
    const sync=()=>setSaved(readFavorites().includes(id))
    sync(); setAudio('speechSynthesis' in window)
    let active=true
    fetch(`/api/case-audio?id=${encodeURIComponent(id)}`).then(response=>response.ok?response.json():null).then(data=>{if(!active)return;if(typeof data?.audioUrl==='string')setAudioUrl(data.audioUrl);if(typeof data?.place==='string')setPlace(data.place)}).catch(()=>{})
    window.addEventListener('storage',sync)
    const stop=()=>{ if(document.hidden) {window.speechSynthesis?.cancel();setSpeaking(false)} }
    document.addEventListener('visibilitychange',stop)
    return ()=>{active=false;window.removeEventListener('storage',sync);document.removeEventListener('visibilitychange',stop);window.speechSynthesis?.cancel()}
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
  async function downloadCard() {
    const width=1200,height=630
    await document.fonts.ready
    await Promise.all([document.fonts.load('700 48px Merriweather'),document.fonts.load('400 20px "IBM Plex Mono"')])
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
    const ctx=canvas.getContext('2d')
    if(!ctx){setMessage('No se pudo generar la tarjeta en este navegador.');return}
    ctx.fillStyle='#090b09';ctx.fillRect(0,0,width,height)
    ctx.fillStyle='#0d0f0c';ctx.fillRect(790,0,410,height)
    ctx.strokeStyle='#24251f';ctx.lineWidth=1
    for(let x=790;x<=1200;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}
    for(let y=0;y<=height;y+=48){ctx.beginPath();ctx.moveTo(790,y);ctx.lineTo(1200,y);ctx.stroke()}
    ctx.strokeStyle='#4b4435';ctx.lineWidth=1
    for(const radius of [220,140,55]){ctx.beginPath();ctx.arc(1080,330,radius,0,Math.PI*2);ctx.stroke()}
    ctx.fillStyle='#d63b35';ctx.beginPath();ctx.arc(1080,330,8,0,Math.PI*2);ctx.fill()
    ctx.strokeStyle='#3b392f';ctx.beginPath();ctx.moveTo(72,135);ctx.lineTo(1128,135);ctx.stroke()
    ctx.fillStyle='#eeeae0';ctx.font='500 24px "IBM Plex Mono", monospace';ctx.fillText('PARANORMIS',72,84)
    ctx.textAlign='right';ctx.fillStyle='#b5af9f';ctx.font='400 18px "IBM Plex Mono", monospace';ctx.fillText('ARCHIVO / COLOMBIA',1128,84);ctx.textAlign='left'
    ctx.fillStyle='#eeeae0';ctx.font='700 48px Merriweather, Georgia, serif'
    const words=title.split(/\s+/);const wrapped:string[]=[];let current=''
    for(const word of words){const candidate=current?`${current} ${word}`:word;if(ctx.measureText(candidate).width>680&&current){wrapped.push(current);current=word}else current=candidate}
    if(current)wrapped.push(current)
    wrapped.slice(0,4).forEach((line,index)=>ctx.fillText(line,72,235+index*63,700))
    ctx.fillStyle='#d63b35';ctx.fillRect(72,507,4,48)
    ctx.fillStyle='#eeeae0';ctx.font='400 20px "IBM Plex Mono", monospace';ctx.fillText(place.slice(0,48),95,524)
    ctx.fillStyle='#b5af9f';ctx.font='400 16px "IBM Plex Mono", monospace';ctx.fillText('TESTIMONIO PUBLICADO · CONSULTA SUS FUENTES',95,554)
    canvas.toBlob(blob=>{if(!blob){setMessage('No se pudo exportar la tarjeta.');return}const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`paranormis-${id}.png`;link.click();window.setTimeout(()=>URL.revokeObjectURL(link.href),1000)},'image/png')
  }
  return <div className="case-tools"><div className="editorial-actions">
    <button type="button" onClick={save} aria-pressed={saved}>{saved?'★ Guardado':'☆ Guardar expediente'}</button>
    <button type="button" onClick={share}>Compartir enlace ↗</button>
    <button type="button" onClick={downloadCard}>Descargar tarjeta</button>
    {audioUrl ? <div className="editorial-audio"><span className="editorial-note">Narración del archivo</span><audio controls preload="metadata" style={{width:'min(100%, 380px)',height:42,accentColor:'#d63b35'}} src={audioUrl}>Tu navegador no puede reproducir este audio.</audio></div> : audio && <button type="button" onClick={narrate} aria-pressed={speaking}>{speaking?'■ Detener lectura':'▷ Escuchar relato'}</button>}
  </div><p className="editorial-note">Favoritos locales · {audioUrl?'Audio narrado por el archivo.':'Lectura opcional con la voz del dispositivo.'}</p><p role="status" className="editorial-note">{message}</p></div>
}
