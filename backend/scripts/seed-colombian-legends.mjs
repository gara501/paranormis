import {createClient} from '@sanity/client'

const token = process.env.SANITY_WRITE_TOKEN
if (!token) throw new Error('Configura SANITY_WRITE_TOKEN para crear los borradores en Sanity.')

const client = createClient({
  projectId: 'en0s05um',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token,
})

const draftId = (id) => `drafts.${id}`
const dryRun = process.argv.includes('--dry-run')

const regions = [
  {key: 'cundinamarca', name: 'Cundinamarca', centroid: {lat: 4.75, lng: -74.05}},
  {key: 'cauca', name: 'Cauca', centroid: {lat: 2.57, lng: -76.95}},
  {key: 'atlantico', name: 'Atlántico', centroid: {lat: 10.7, lng: -75.0}},
]

const creatures = [
  {
    key: 'espiritus-lugares',
    name: 'Espíritus y almas en pena',
    description: 'Categoría editorial para relatos que atribuyen presencias o ecos a personas fallecidas. Agrupa tradiciones distintas y no confirma una causa paranormal.',
    traits: ['Presencia atribuida a una persona fallecida', 'Voces, sonidos o apariciones reportados'],
  },
  {
    key: 'nina-fantasma-transmilenio',
    name: 'La niña fantasma de TransMilenio',
    description: 'Figura de una leyenda urbana bogotana, descrita en publicaciones como una niña que advertiría a pasajeros sobre posibles robos. Es un personaje de tradición oral y relatos difundidos.',
    traits: ['Figura infantil reportada en una estación', 'Advertencias sobre posibles robos'],
  },
  {
    key: 'fantasma-jose-raimundo-russi',
    name: 'El fantasma de José Raimundo Russi',
    description: 'Personaje de relatos sobre apariciones en el centro histórico de Bogotá, asociado a la memoria del abogado José Raimundo Russi, ejecutado en 1851.',
    traits: ['Figura masculina con traje de época', 'Aparición atribuida a La Candelaria o la Plaza de Bolívar'],
  },
]

const cases = [
  {
    key: 'espantos-refugio-del-salto',
    sourceUrl: 'https://www.eltiempo.com/colombia/otras-ciudades/colombia-los-lugares-mas-terrorificos-que-existen-en-el-pais-496852',
    title: 'Los espantos del Refugio del Salto',
    city: 'Salto del Tequendama, Soacha, Cundinamarca',
    creatureKey: 'espiritus-lugares', regionKey: 'cundinamarca',
    location: {lat: 4.5678, lng: -74.2981}, locationPrecision: 'locality',
    date: '2020-10-11T12:00:00-05:00', dateBasis: 'record_date', timeOfDay: 'unspecified',
    dateNotes: 'Fecha de publicación del reportaje de El Tiempo. La nota atribuye espantos al antiguo hotel Refugio del Salto. Como contexto histórico, Cerosetenta indica que el 22 de enero de 1941 se recuperó por primera vez un cuerpo del salto; esa fecha no marca el fin de los suicidios ni fecha una aparición.',
    accountType: 'press_report',
    sourceTitle: 'Estos son los siete lugares más terroríficos que existen en Colombia — El Tiempo',
    additionalSources: [{_key: 'cerosetenta', title: 'Los suicidas del Tequendama — Cerosetenta', url: 'https://cerosetenta.uniandes.edu.co/los-suicidas-del-tequendama/'}],
    freeformDescription: 'El Tiempo recoge relatos de supuestos espantos en el antiguo hotel Refugio del Salto, frente al Salto del Tequendama, y los atribuye a personas que habrían muerto allí en peleas. La nota documenta una tradición local, no una aparición comprobada. Cerosetenta aporta el contexto histórico del llamado Lago de los Muertos; el 22 de enero de 1941 corresponde a la recuperación del cuerpo de Eduardo Umaña, no al cese de los suicidios. El punto del mapa es una referencia aproximada del lugar.',
  },
  {
    key: 'morgue-san-juan-de-dios',
    sourceUrl: 'https://www.metrocuadrado.com/noticias/actualidad/tres-lugares-embrujados-en-bogota-809',
    title: 'La morgue del San Juan de Dios',
    city: 'Bogotá, D. C.',
    creatureKey: 'espiritus-lugares', regionKey: 'bogota',
    location: {lat: 4.5936, lng: -74.0847}, locationPrecision: 'locality',
    date: '2015-04-13T12:00:00-05:00', dateBasis: 'record_date', timeOfDay: 'unspecified',
    dateNotes: 'Índices bibliográficos identifican el 13 de abril de 2015 como fecha de publicación; la página actual de Metrocuadrado no muestra la fecha. La fecha 2021-10-25 proporcionada no coincide con esos registros.',
    accountType: 'press_report',
    sourceTitle: 'Tres lugares embrujados en Bogotá — Metrocuadrado',
    freeformDescription: 'Metrocuadrado acompañó al parasicólogo Edwin Robles en una visita al Hospital San Juan de Dios. Robles dijo que percibía más actividad en la morgue y trató de registrar psicofonías; el artículo también recoge la leyenda de una monja que atendía pacientes. El reportaje registra las afirmaciones del visitante y relatos asociados al hospital, no evidencia de una presencia paranormal. El punto marca el hospital como referencia aproximada.',
  },
  {
    key: 'nina-bicentenario-transmilenio',
    sourceUrl: 'https://www.colombia.com/paranormal/noticias/nina-fantasma-alerta-a-pasajeros-de-transmilenio-sobre-posibles-robos-492454',
    title: 'La niña fantasma de la estación Bicentenario',
    city: 'Bogotá, D. C. · estación Bicentenario',
    creatureKey: 'nina-fantasma-transmilenio', regionKey: 'bogota',
    location: {lat: 4.6097, lng: -74.0817}, locationPrecision: 'region',
    date: '2024-11-06T12:00:00-05:00', dateBasis: 'record_date', timeOfDay: 'unspecified',
    dateNotes: 'Fecha de publicación de Colombia.com. La ubicación del mapa usa el punto céntrico entregado como referencia de Bogotá; no representa las coordenadas exactas de la estación Bicentenario.',
    accountType: 'press_report',
    sourceTitle: 'Leyenda urbana en Transmilenio: “Niña fantasma” alerta a pasajeros sobre posibles robos — Colombia.com',
    freeformDescription: 'Colombia.com publicó el relato que el antropólogo Esteban Cruz Niño atribuye a una mujer: una niña se habría acercado en la estación Bicentenario para advertirle de un posible robo. La nota también menciona que la historia circuló en redes y aclara que no existe evidencia científica que pruebe el fenómeno. Se conserva como leyenda urbana difundida por un medio; el punto es una referencia de Bogotá, no la ubicación precisa del episodio.',
  },
  {
    key: 'ecos-prision-gorgona',
    sourceUrl: 'https://www.eltiempo.com/colombia/otras-ciudades/colombia-los-lugares-mas-terrorificos-que-existen-en-el-pais-496852',
    title: 'Los ecos paranormales de la antigua prisión de Gorgona',
    city: 'Isla Gorgona, Guapi, Cauca',
    creatureKey: 'espiritus-lugares', regionKey: 'cauca',
    location: {lat: 2.9667, lng: -78.1833}, locationPrecision: 'locality',
    date: '2020-10-11T12:00:00-05:00', dateBasis: 'record_date', timeOfDay: 'unspecified',
    dateNotes: 'Fecha de publicación de El Tiempo, que reemplaza la fecha 2019-10-31 aportada, no confirmada en la fuente consultada. El reportaje habla de una investigación de una semana y de detecciones interpretadas por el investigador; no atribuye a guardaparques o biólogos los lamentos y cadenas descritos en el texto inicial.',
    accountType: 'press_report',
    sourceTitle: 'Estos son los siete lugares más terroríficos que existen en Colombia — El Tiempo',
    freeformDescription: 'El Tiempo reseña la visita de una semana de un investigador paranormal a la isla Gorgona y recoge su interpretación de detecciones en equipos electromagnéticos como contacto con otra energía. El reportaje también contextualiza la antigua prisión y sus ruinas. El relato de investigación no verifica una explicación sobrenatural ni respalda las versiones de cadenas y lamentos atribuidas a guardaparques. El punto representa la isla de forma aproximada.',
  },
  {
    key: 'fantasma-jose-raimundo-russi',
    sourceUrl: 'https://www.eltiempo.com/bogota/bogota-mitos-de-terror-de-sus-calles-y-del-cementerio-central-628763',
    title: 'El fantasma de José Raimundo Russi',
    city: 'La Candelaria, Bogotá, D. C.',
    creatureKey: 'fantasma-jose-raimundo-russi', regionKey: 'bogota',
    location: {lat: 4.5967, lng: -74.0733}, locationPrecision: 'locality',
    date: '2021-10-29T12:00:00-05:00', dateBasis: 'record_date', timeOfDay: 'night',
    dateNotes: 'Fecha del artículo de El Tiempo. El reportaje sitúa la ejecución de Russi en julio de 1851, pero la fecha de ejecución no es la fecha de una aparición. La fuente consultada no respalda que el espectro aparezca decapitado.',
    accountType: 'folklore',
    sourceTitle: 'Cinco mitos de terror que hay en las calles bogotanas — El Tiempo',
    freeformDescription: 'El Tiempo recoge el mito de que José Raimundo Russi, abogado fusilado en 1851, todavía recorrería la Plaza de Bolívar y sus alrededores por la noche. Un comerciante de la zona contó al periódico que dejaba agua para él. Se registra como tradición urbana atribuida por la fuente; el artículo no demuestra la aparición ni respalda la descripción de un espectro decapitado. El punto representa el centro histórico de forma aproximada.',
  },
  {
    key: 'novia-puerto-colombia',
    sourceUrl: 'https://www.eltiempo.com/colombia/otras-ciudades/mitos-urbanos-de-barranquilla-87492',
    title: 'La novia de Puerto Colombia',
    city: 'Vía Puerto Colombia–Barranquilla, Atlántico',
    creatureKey: 'carretera', regionKey: 'atlantico',
    location: {lat: 11.0049, lng: -74.9458}, locationPrecision: 'locality',
    date: '2017-05-12T12:00:00-05:00', dateBasis: 'record_date', timeOfDay: 'night',
    dateNotes: 'Fecha de publicación de El Tiempo. La leyenda no tiene una fecha de episodio identificable. El artículo solo respalda que se cuenta que una mujer vestida de novia aparece de noche en la vía; no incluye el relato de que suba a un vehículo y luego desaparezca.',
    accountType: 'folklore',
    sourceTitle: 'Las historias que más asustan a Barranquilla — El Tiempo',
    additionalSources: [{_key: 'elheraldo', title: 'Mitos y leyendas del Atlántico en el mes de las brujas — El Heraldo', url: 'https://www.elheraldo.co/entretenimiento/mitos-y-leyendas-del-atlantico-en-el-mes-de-las-brujas-417935'}],
    freeformDescription: 'El Tiempo presenta como mito la aparición nocturna de una mujer vestida de novia en la carretera entre Puerto Colombia y Barranquilla, conocida como “La novia de Puerto Colombia”. La nota advierte que no hay certeza de que estas historias sean ciertas. Se archiva la versión respaldada por la fuente; no se incluye el episodio de recogerla en un vehículo porque no apareció en el reportaje consultado. El punto señala un tramo aproximado, no un sitio exacto.',
  },
]

const [existingRegions, existingCreatures, existingSightings] = await Promise.all([
  client.fetch('*[_type == "region"]{_id,name}'),
  client.fetch('*[_type == "creature"]{_id,name}'),
  client.fetch('*[_type == "sighting"]{_id,sourceUrl}'),
])

const regionByName = new Map(existingRegions.filter((doc) => !doc._id.startsWith('drafts.')).map((doc) => [doc.name, doc._id]))
const creatureByName = new Map(existingCreatures.filter((doc) => !doc._id.startsWith('drafts.')).map((doc) => [doc.name, doc._id]))
const regionId = new Map(regions.map((item) => [item.key, regionByName.get(item.name) ?? draftId(`region-${item.key}`)]))
const creatureId = new Map(creatures.map((item) => [item.key, creatureByName.get(item.name) ?? draftId(`creature-${item.key}`)]))
creatureId.set('carretera', creatureByName.get('La Mujer Fantasma de la Carretera'))
regionId.set('bogota', regionByName.get('Bogotá'))

if (!regionId.get('bogota') || !creatureId.get('carretera')) {
  throw new Error('Falta una referencia publicada esperada: Bogotá o La Mujer Fantasma de la Carretera.')
}

const duplicates = cases.filter((item) => existingSightings.some((doc) => doc.sourceUrl === item.sourceUrl && doc._id !== draftId(`sighting-${item.key}`)))
if (duplicates.length) {
  throw new Error(`Ya existen fichas para fuentes compartidas (${duplicates.map((item) => item.title).join(', ')}). Revisa duplicados antes de importar; no se creó ningún documento.`)
}

const missingReferenceNames = [
  ...regions.filter((item) => !regionByName.has(item.name)).map((item) => `Región: ${item.name}`),
  ...creatures.filter((item) => !creatureByName.has(item.name)).map((item) => `Criatura: ${item.name}`),
]

if (dryRun) {
  console.log(JSON.stringify({mode: 'simulación', expedientes: cases.map((item) => item.title), referenciasQueSeCrearánComoBorrador: missingReferenceNames, fuentesDuplicadas: 0}, null, 2))
  process.exit(0)
}

let transaction = client.transaction()
for (const region of regions) {
  if (!regionByName.has(region.name)) transaction = transaction.createIfNotExists({
    _id: draftId(`region-${region.key}`), _type: 'region', name: region.name, country: 'Colombia',
    centroid: {_type: 'geopoint', ...region.centroid},
  })
}
for (const creature of creatures) {
  if (!creatureByName.has(creature.name)) transaction = transaction.createIfNotExists({
    _id: draftId(`creature-${creature.key}`), _type: 'creature', name: creature.name,
    physicalDescription: creature.description, distinctiveTraits: creature.traits,
    threatLevel: 'unknown', folkloreOrigin: 'Categoría editorial basada en relatos publicados; su existencia paranormal no se considera verificada.',
  })
}
for (const item of cases) {
  transaction = transaction.createIfNotExists({
    _id: draftId(`sighting-${item.key}`), _type: 'sighting',
    title: item.title, city: item.city, editorialApproved: false,
    creature: {_type: 'reference', _ref: creatureId.get(item.creatureKey)},
    region: {_type: 'reference', _ref: regionId.get(item.regionKey)},
    location: {_type: 'geopoint', ...item.location}, locationPrecision: item.locationPrecision,
    date: item.date, dateBasis: item.dateBasis, dateNotes: item.dateNotes, timeOfDay: item.timeOfDay,
    accountType: item.accountType, status: 'pending', sourceTitle: item.sourceTitle, sourceUrl: item.sourceUrl,
    ...(item.additionalSources ? {additionalSources: item.additionalSources} : {}),
    freeformDescription: item.freeformDescription,
  })
}
await transaction.commit()
console.log(JSON.stringify({mode: 'borradores creados', expedientes: cases.length, regionesBorrador: regions.filter((item) => !regionByName.has(item.name)).length, criaturasBorrador: creatures.filter((item) => !creatureByName.has(item.name)).length}, null, 2))
