import {useEffect,useMemo,useState} from 'react'
import {caseDate,casePath,normalizeSearch,type EditorialCase} from '../lib/editorial'
import {readFavorites} from './CaseActions'
export default function CaseExplorer({cases}:{cases:EditorialCase[]}) {
  const [search,setSearch]=useState('')
  const [city,setCity]=useState('')
  const [onlySaved,setOnlySaved]=useState(false)
  const [saved,setSaved]=useState<string[]>([])
  useEffect(()=>{const sync=()=>setSaved(readFavorites());sync();window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[])
  const cities=useMemo(()=>Array.from(new Set(cases.map(c=>c.city).filter((c):c is string=>!!c))).sort((a,b)=>a.localeCompare(b,'es')), [cases])
  const results=cases.filter(c=>(!city||c.city===city)&&(!onlySaved||saved.includes(c._id))&&normalizeSearch([c.title,c.city,c.region?.name,c.creature?.name].join(' ')).includes(normalizeSearch(search)))
  return <section aria-label="Buscar expedientes"><div className="editorial-filters">
    <label>Buscar en el archivo<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ciudad, entidad o expediente…"/></label>
    <label>Ciudad<select value={city} onChange={e=>setCity(e.target.value)}><option value="">Todas las ciudades</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
    <label className="editorial-checkbox"><input type="checkbox" checked={onlySaved} onChange={e=>setOnlySaved(e.target.checked)}/> Solo mis guardados</label>
  </div><p className="editorial-eyebrow" role="status">{results.length} {results.length===1?'expediente disponible':'expedientes disponibles'}</p>
    <div className="editorial-grid">{results.map((c,index)=><article className="editorial-card" key={c._id}><p className="editorial-eyebrow">{String(index+1).padStart(2,'0')} / {c.city||c.region?.name}</p><h2><a href={casePath(c._id)}>{c.title}</a></h2><p className="editorial-note">{caseDate(c)}</p><p>{c.freeformDescription}</p><a className="editorial-link" href={casePath(c._id)}>Leer expediente y fuentes ↗</a></article>)}</div>
    {!results.length&&<div className="editorial-panel"><h2>No hay expedientes para esta selección</h2><p>{onlySaved?'Guarda un expediente desde su página para encontrarlo aquí.':'Prueba otra ciudad o término. El archivo contiene una selección editorial; la ausencia de registros no describe la actividad de una zona.'}</p></div>}
  </section>
}
