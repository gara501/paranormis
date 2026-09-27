export interface EditorialReport {
  id: string
  title: string
  city: string
  classification: string
  summary: string
  dateNote: string
  sourceTitle: string
  sourceUrl: string
}

// Published accounts, not independently verified paranormal events.
export const editorialReports: EditorialReport[] = [
  {
    id: 'mano-reptiliana', title: 'La mano reptiliana del andén', city: 'Colombia · lugar no identificado', classification: 'Testimonio difundido en video',
    summary: 'Infobae recoge el relato de una mujer que dijo haber visto una mano de aspecto reptiliano salir del suelo y sujetarla. La fuente no precisa la calle ni la ciudad.',
    dateNote: 'Relato situado a principios de los años 2000; nota publicada el 18 de abril de 2025.',
    sourceTitle: 'Un árbol maldito y una desaparición inexplicable — Infobae', sourceUrl: 'https://www.infobae.com/colombia/2025/04/18/un-arbol-maldito-y-una-desaparicion-inexplicable-historias-paranormales-de-semana-santa-en-colombia/',
  },
  {
    id: 'mujer-balcon-popayan', title: 'La mujer que gritaba desde un balcón en Popayán', city: 'Popayán, Cauca', classification: 'Relato de una vigía del patrimonio',
    summary: 'Una vigía contó que durante una charla en el Parque Caldas vio y oyó a una mujer en el balcón de un hotel. La policía revisó el lugar, pero no encontró a nadie.',
    dateNote: 'Fecha del episodio no precisada; nota publicada el 18 de abril de 2025.',
    sourceTitle: 'Un árbol maldito y una desaparición inexplicable — Infobae', sourceUrl: 'https://www.infobae.com/colombia/2025/04/18/un-arbol-maldito-y-una-desaparicion-inexplicable-historias-paranormales-de-semana-santa-en-colombia/',
  },
  {
    id: 'fantasma-mangos', title: 'El fantasma que regalaba mangos', city: 'Envigado, Antioquia', classification: 'Caso narrado por una investigadora',
    summary: 'El Espectador resume el relato de una familia que dijo que un niño jugaba con una presencia infantil en su casa y que una adulta también percibió una sombra. La familia decidió mudarse; el artículo atribuye la historia al libro Colombia Sobrenatural.',
    dateNote: 'Fecha del episodio no precisada; entrevista publicada el 6 de agosto de 2015.',
    sourceTitle: 'Colombia tiene fenómenos paranormales aterradores: Mado Martínez — El Espectador', sourceUrl: 'https://www.elespectador.com/actualidad/colombia-tiene-fenomenos-paranormales-aterradores-mado-martinez-article-577647/',
  },
  {
    id: 'abduccion-guatavita', title: 'La abducción relatada en la laguna de Guatavita', city: 'Guatavita, Cundinamarca', classification: 'Relato de segunda fuente',
    summary: 'En una entrevista, la investigadora Mado Martínez mencionó un relato de presunta abducción asociado a la laguna. El artículo no identifica a la persona ni fecha el episodio; no constituye corroboración del suceso.',
    dateNote: 'Fecha del episodio no precisada; entrevista publicada el 6 de agosto de 2015.',
    sourceTitle: 'Colombia tiene fenómenos paranormales aterradores: Mado Martínez — El Espectador', sourceUrl: 'https://www.elespectador.com/actualidad/colombia-tiene-fenomenos-paranormales-aterradores-mado-martinez-article-577647/',
  },
  {
    id: 'bus-morado', title: 'El bus morado de TransMilenio', city: 'Bogotá, D. C.', classification: 'Leyenda urbana difundida en redes',
    summary: 'Infobae recopila la leyenda de un supuesto bus morado que circularía de madrugada por la ruta ficticia G66. La nota advierte que esa ruta no figura en la oferta oficial de TransMilenio.',
    dateNote: 'Relato reciente en redes, sin fecha de incidente; nota publicada el 31 de octubre de 2024.',
    sourceTitle: 'Los misterios paranormales de Bogotá — Infobae', sourceUrl: 'https://www.infobae.com/colombia/2024/10/31/los-misterios-paranormales-de-bogota-las-historias-que-transitan-las-calles/',
  },
  {
    id: 'taxi-testimonio', title: 'La aparición en el asiento trasero del taxi', city: 'Bogotá, D. C.', classification: 'Testimonio atribuido a un taxista',
    summary: 'El taxista Galeano Morales contó a Infobae que una figura a la que había ignorado apareció en el asiento trasero durante una noche lluviosa. La fuente no precisa el año ni el sector.',
    dateNote: 'Diciembre, año no precisado; nota publicada el 31 de octubre de 2024.',
    sourceTitle: 'Los misterios paranormales de Bogotá — Infobae', sourceUrl: 'https://www.infobae.com/colombia/2024/10/31/los-misterios-paranormales-de-bogota-las-historias-que-transitan-las-calles/',
  },
  {
    id: 'edificio-coltabaco', title: 'Golpes y luces en el edificio Coltabaco', city: 'Cali, Valle del Cauca', classification: 'Relatos atribuidos a una exfuncionaria',
    summary: 'Una nota de Infobae sobre recorridos nocturnos en Cali menciona golpes, luces que se encendían y apagaban y sonidos en el edificio Coltabaco. Se presenta como relato publicado, sin verificación independiente.',
    dateNote: 'Fecha del episodio no precisada; nota publicada el 25 de marzo de 2025.',
    sourceTitle: 'Así es Santiago de Cali después de la medianoche — Infobae', sourceUrl: 'https://www.infobae.com/colombia/2025/03/25/asi-es-santiago-de-cali-despues-de-la-medianoche-youtuber-revelo-historias-paranormales/',
  },
  {
    id: 'casa-medellin', title: 'El relato de la casa embrujada en Medellín', city: 'Medellín, Antioquia', classification: 'Relato familiar publicado',
    summary: 'Colombia.com reproduce la versión de una familia que atribuyó una presencia en una vivienda antigua a un episodio médico de su hija. El artículo no aporta documentación clínica; aquí se conserva solo como relato atribuido.',
    dateNote: 'Fecha del episodio no precisada; publicación de 2025.',
    sourceTitle: 'Historias de miedo más escalofriantes de Colombia — Colombia.com', sourceUrl: 'https://www.colombia.com/paranormal/noticias/pura-vaina-rara-las-historias-de-miedo-mas-escalofriantes-de-colombia-514342',
  },
  {
    id: 'monja-tequendama', title: 'La monja del Salto del Tequendama', city: 'Salto del Tequendama, Cundinamarca', classification: 'Testimonio recogido por un medio',
    summary: 'El Tiempo presentó relatos de guías del Salto y el testimonio de Patricia España sobre una aparición atribuida a una monja. La nota documenta que el relato fue contado, no que la aparición haya ocurrido.',
    dateNote: 'Nota publicada el 29 de noviembre de 2017; fecha del episodio no precisada.',
    sourceTitle: 'El espíritu de la monja que se aparece en el Salto del Tequendama — El Tiempo', sourceUrl: 'https://www.eltiempo.com/colombia/otras-ciudades/los-fantasmas-del-salto-del-tequendama-156350',
  },
  {
    id: 'fantasma-armero', title: 'El fantasma de Armero captado en cámara', city: 'Armero, Tolima', classification: 'Experiencia contada por un cantante',
    summary: 'Luis Alfonso relató que grabó lo que interpretó como una aparición al visitar el cementerio de Armero. La nota recoge su versión y la circulación del video, sin confirmar qué muestra.',
    dateNote: 'Nota publicada el 31 de julio de 2025; fecha de la visita no precisada.',
    sourceTitle: 'Fantasma de Armero fue captado en cámara — Semana', sourceUrl: 'https://www.semana.com/gente/articulo/fantasma-de-armero-fue-captado-en-camara-por-luis-alfonso-el-video-causo-conmocion/202515/',
  },
  {
    id: 'nina-bicentenario', title: 'La niña fantasma de la estación Bicentenario', city: 'Bogotá, D. C.', classification: 'Relato difundido entre usuarios',
    summary: 'Noticias Caracol recogió una historia sobre una niña que advertiría a pasajeros de posibles robos en la estación Bicentenario. La pieza atribuye el relato a una mujer entrevistada en un programa paranormal.',
    dateNote: 'Nota publicada el 5 de noviembre de 2024; fecha del episodio no precisada.',
    sourceTitle: '¿Niña fantasma en estación de TransMilenio? — Noticias Caracol', sourceUrl: 'https://www.noticiascaracol.com/lomastrinado/nina-fantasma-en-estacion-de-transmilenio-usuarios-afirman-que-la-ven-y-la-oyen-rg10',
  },
  {
    id: 'presentador-aparicion', title: 'El presentador que dijo ver una aparición', city: 'Bogotá · lugar del episodio no precisado', classification: 'Testimonio de un periodista',
    summary: 'El periodista Edward Porras contó que, después de cubrir el hallazgo de una mujer en Fontibón, vivió una experiencia que interpretó como paranormal al llegar a su casa. Fontibón es el lugar de la noticia que cubrió, no una ubicación confirmada de la aparición.',
    dateNote: 'Nota publicada el 16 de octubre de 2025; fecha del episodio no precisada.',
    sourceTitle: 'Presentador de Noticias Caracol reveló que vio un fantasma — Publimetro', sourceUrl: 'https://www.publimetro.co/entretenimiento/2025/10/16/presentador-de-noticias-caracol-revelo-que-vio-el-fantasma-mujer-despues-de-informar-su-muerte-en-el-noticiero/',
  },
  {
    id: 'restaurante-bruja', title: 'El fantasma del restaurante La Bruja', city: 'La Candelaria, Bogotá', classification: 'Relatos de empleados y clientes',
    summary: 'Metrocuadrado recoge versiones de empleados y clientes de un restaurante de La Candelaria que describen objetos movidos y una presencia en la cocina. El artículo también transmite una leyenda local asociada al nombre del lugar.',
    dateNote: 'Fecha de los relatos no precisada.',
    sourceTitle: 'Tres lugares embrujados en Bogotá — Metrocuadrado', sourceUrl: 'https://www.metrocuadrado.com/noticias/actualidad/tres-lugares-embrujados-en-bogota-809',
  },
]
