import {createClient} from '@sanity/client'
const client = createClient({projectId:'en0s05um',dataset:'production',apiVersion:'2024-01-01',useCdn:false,token:process.env.SANITY_WRITE_TOKEN})
if (!process.env.SANITY_WRITE_TOKEN) throw new Error('Falta SANITY_WRITE_TOKEN; utiliza el entorno privado del backend.')
const dryRun = process.argv.includes('--dry-run')
const known = [
  ['https://www.eltiempo.com/cultura/gente/monja-de-la-calle-100-la-oscura-historia-del-mito-bogotano-752987','La monja de la calle 100','Bogotá'],
  ['https://www.elcolombiano.com/historico/el_fantasma_sigue_en_prado-KEEC_18640','Los sonidos de la casa de Prado','Medellín'],
  ['https://caracol.com.co/radio/2022/04/18/nacional/1650315357_699141.html','Una luz sobre las montañas de Ibagué','Ibagué'],
  ['https://www.noticiasrcn.com/tendencias/piloto-grabo-un-ovni-en-pleno-vuelo-por-los-cielos-colombianos-video-443838','El objeto filmado por un piloto en Antioquia','Santa Fe de Antioquia'],
]
const docs = await client.fetch('*[_type == "sighting" && sourceUrl in $urls && !(_id in path("drafts.**"))]{_id,_rev,sourceUrl}',{urls:known.map(x=>x[0])})
for (const [url] of known) if (docs.filter(x=>x.sourceUrl===url).length!==1) throw new Error('La selección editorial no coincide con los cuatro casos esperados.')
const region = await client.fetch('*[_type == "region" && name == "Bogotá" && !(_id in path("drafts.**"))][0]{_id}')
if (!region) throw new Error('No existe la región Bogotá.')
const sourceUrl='https://www.idartes.gov.co/en/node/13738'
const existing = await client.fetch('*[_type == "sighting" && sourceUrl == $url && !(_id in path("drafts.**"))][0]{_id}',{url:sourceUrl})
const creature = await client.fetch('*[_type == "creature" && name == "El excavador del Gaitán" && !(_id in path("drafts.**"))][0]{_id}')
console.log(JSON.stringify({mode:dryRun?'simulación':'publicación',approve:known.map(x=>x[1]),createTheater:!existing},null,2))
if (dryRun) process.exit(0)
const entity = creature ?? await client.create({_type:'creature',name:'El excavador del Gaitán',regions:[{_key:'bogota',_type:'reference',_ref:region._id}],physicalDescription:'Presencia descrita a partir de ruidos de excavación en un relato del Teatro Jorge Eliécer Gaitán. La fuente institucional no establece una apariencia física verificable.',distinctiveTraits:['Sonidos atribuidos a excavación','Ruidos nocturnos en el teatro'],threatLevel:'unknown',folkloreOrigin:'Relato compartido por Sandra Vega en el programa Fantasmas tras bastidores de Idartes (2020). Su publicación documenta el testimonio, sin demostrar una causa sobrenatural.'})
let transaction=client.transaction()
for (const [url,title,city] of known) {
  const doc=docs.find(x=>x.sourceUrl===url)
  transaction=transaction.patch(doc._id,p=>p.ifRevisionId(doc._rev).set({title,city,editorialApproved:true}))
}
if (!existing) transaction=transaction.create({_type:'sighting',title:'El excavador del Gaitán',city:'Bogotá',editorialApproved:true,creature:{_type:'reference',_ref:entity._id},region:{_type:'reference',_ref:region._id},location:{_type:'geopoint',lat:4.60876,lng:-74.07092},locationPrecision:'locality',date:'2020-06-11T12:00:00-05:00',dateBasis:'record_date',dateNotes:'La fecha corresponde a la publicación de Idartes. Esa fuente sitúa el relato en agosto de 2002; Infobae menciona 2003. No se conoce el día del episodio y la discrepancia sigue sin resolverse.',timeOfDay:'night',accountType:'press_report',status:'pending',sourceTitle:'¿Cómo se trabaja con la compañía de fantasmas? — Idartes',sourceUrl,additionalSources:[{_key:'programa',title:'El Gaitán estrena Fantasmas tras bastidores — Idartes',url:'https://www.idartes.gov.co/es/agenda/presentacion/gaitan-estrena-fantasmas-bastidores'},{_key:'infobae',title:'Los misterios paranormales de Bogotá — Infobae',url:'https://www.infobae.com/colombia/2024/10/31/los-misterios-paranormales-de-bogota-las-historias-que-transitan-las-calles/'}],freeformDescription:'Sandra Vega, encargada de camerinos y vestuario, compartió un relato de ruidos nocturnos asociados a una supuesta excavación en el Teatro Jorge Eliécer Gaitán. Idartes lo presentó en su programa Fantasmas tras bastidores. La institución sitúa el episodio en agosto de 2002, después de las diez de la noche. El archivo registra un testimonio publicado, sin corroboración de una explicación paranormal. El punto señala el edificio del teatro como referencia aproximada.',observedTraits:['Ruidos nocturnos','Sonidos de excavación'],witness:{anonymous:false,name:'Sandra Vega',occupation:'Encargada de camerinos y vestuario',baseCredibility:3,witnessState:'unspecified'}})
await transaction.commit()
console.log('Expedientes editoriales publicados. No se modificaron casos fuera de la selección.')
