import {createClient} from '@sanity/client'

const token = process.env.SANITY_WRITE_TOKEN
if (!token) throw new Error('Configura SANITY_WRITE_TOKEN para escribir en Sanity.')

const client = createClient({
  projectId: 'en0s05um',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token,
})

// Solo expedientes con un caso individual publicado. Un reporte no verifica su explicación paranormal.
// Las coordenadas son referencias cartográficas aproximadas, nunca la posición exacta del testigo.
const cases = [
  {
    creature: 'La Monja Fantasma',
    region: 'Bogotá',
    sourceTitle: 'Monja de la calle 100: la oscura historia del mito bogotano — El Tiempo',
    sourceUrl: 'https://www.eltiempo.com/cultura/gente/monja-de-la-calle-100-la-oscura-historia-del-mito-bogotano-752987',
    date: '2023-03-23T12:00:00-05:00',
    dateBasis: 'record_date',
    timeOfDay: 'night',
    location: {lat: 4.68684, lng: -74.05198},
    locationPrecision: 'locality',
    accountType: 'press_report',
    witness: {anonymous: false, name: 'Galeano Morales', occupation: 'Taxista', baseCredibility: 3, witnessState: 'unspecified'},
    freeformDescription: 'El taxista Galeano Morales relató que, una noche lluviosa de diciembre de año no precisado, observó a una mujer vestida de monja en el puente de la calle 100 con carrera Séptima. Según su relato, segundos después la vio en el asiento trasero de su taxi. El Tiempo publicó el testimonio el 23 de marzo de 2023; esa es la fecha del registro, no la del supuesto encuentro. El punto del mapa es una referencia aproximada del cruce.',
    observedTraits: ['Figura con hábito de monja', 'Aparición en un vehículo'],
  },
  {
    creature: 'Poltergeist',
    region: 'Antioquia',
    sourceTitle: 'El fantasma sigue en la casa de Prado — El Colombiano',
    sourceUrl: 'https://www.elcolombiano.com/historico/el_fantasma_sigue_en_prado-KEEC_18640',
    date: '2008-10-25T12:00:00-05:00',
    dateBasis: 'record_date',
    timeOfDay: 'day',
    location: {lat: 6.24574, lng: -75.5822},
    locationPrecision: 'locality',
    accountType: 'press_report',
    witness: {anonymous: false, name: 'Luz Elena Benítez', occupation: 'Trabajadora de la casa de Prado', baseCredibility: 3, witnessState: 'unspecified'},
    freeformDescription: 'Luz Elena Benítez contó a El Colombiano que, cuando no había nadie por la mañana en la antigua residencia de alcaldes del barrio Prado, se oían golpes o pasos en el techo. La noticia también recoge relatos de otros trabajadores. Se clasifica en el archivo como actividad atribuida a un poltergeist, sin evidencia de esa causa. La fecha es la de publicación, no la de un episodio individual; el punto solo señala Medellín de forma aproximada.',
    observedTraits: ['Golpes', 'Pasos sin fuente identificada'],
  },
  {
    creature: 'Avistamiento OVNI',
    region: 'Tolima',
    sourceTitle: 'En video quedó captado supuesto Ovni luminoso en montañas de Colombia — Caracol Radio',
    sourceUrl: 'https://caracol.com.co/radio/2022/04/18/nacional/1650315357_699141.html',
    date: '2022-04-14T15:30:00-05:00',
    dateBasis: 'event',
    timeOfDay: 'day',
    location: {lat: 4.43572549, lng: -75.20288647},
    locationPrecision: 'locality',
    accountType: 'press_report',
    freeformDescription: 'Caracol Radio informó que un video atribuido al portal Torre El Dorado mostraba un objeto luminoso sobre las montañas de Ibagué el Jueves Santo de 2022, hacia las 3:30 p. m. Según el reporte, permaneció visible cerca de diez minutos. La identidad del objeto no quedó establecida. El punto marca Ibagué, no la posición del objeto ni el lugar exacto de grabación.',
    observedTraits: ['Objeto luminoso', 'Permanencia aparente en el cielo'],
  },
  {
    creature: 'Avistamiento OVNI',
    region: 'Antioquia',
    sourceTitle: 'Piloto grabó un «ovni» en pleno vuelo por los cielos colombianos — Noticias RCN',
    sourceUrl: 'https://www.noticiasrcn.com/tendencias/piloto-grabo-un-ovni-en-pleno-vuelo-por-los-cielos-colombianos-video-443838',
    date: '2022-05-12T13:08:00-05:00',
    dateBasis: 'event',
    timeOfDay: 'day',
    location: {lat: 6.55687, lng: -75.82806},
    locationPrecision: 'region',
    accountType: 'press_report',
    witness: {anonymous: false, name: 'Jorge Arteaga', occupation: 'Piloto', baseCredibility: 3, witnessState: 'unspecified'},
    freeformDescription: 'El piloto Jorge Arteaga difundió un video grabado durante un vuelo sobre el sector de Santa Fe de Antioquia. Noticias RCN sitúa la grabación el 12 de mayo de 2022 alrededor de la 1:08 p. m. Se observa un objeto cuya identificación no se establece en el reporte. El punto marca el municipio como referencia regional; no representa la posición de la aeronave ni una trayectoria comprobada.',
    observedTraits: ['Objeto aéreo grabado en video'],
  },
]

const [creatures, regions, sightings] = await Promise.all([
  client.fetch('*[_type == "creature" && !(_id in path("drafts.**"))]{_id,name}'),
  client.fetch('*[_type == "region" && !(_id in path("drafts.**"))]{_id,name}'),
  client.fetch('*[_type == "sighting" && !(_id in path("drafts.**"))]{sourceUrl}'),
])
const creatureByName = new Map(creatures.map((doc) => [doc.name, doc._id]))
const regionByName = new Map(regions.map((doc) => [doc.name, doc._id]))
const knownSources = new Set(sightings.map((doc) => doc.sourceUrl).filter(Boolean))
const missing = cases.filter((item) => !creatureByName.has(item.creature) || !regionByName.has(item.region))
if (missing.length) throw new Error('Faltan referencias: ' + missing.map((item) => item.creature + ' / ' + item.region).join(', '))

const pending = cases.filter((item) => !knownSources.has(item.sourceUrl))
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({casosDefinidos: cases.length, casosPorCrear: pending.map((item) => item.sourceTitle)}, null, 2))
  process.exit(0)
}

for (const item of pending) {
  const {creature, region, location, ...fields} = item
  await client.create({
    _type: 'sighting',
    ...fields,
    creature: {_type: 'reference', _ref: creatureByName.get(creature)},
    region: {_type: 'reference', _ref: regionByName.get(region)},
    location: {_type: 'geopoint', ...location},
    status: 'pending',
  })
  console.log('Avistamiento creado: ' + creature + ' · ' + region)
}

console.log(JSON.stringify({casosDefinidos: cases.length, casosCreados: pending.length, casosYaPresentes: cases.length - pending.length}))
