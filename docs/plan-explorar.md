# Renovación de Explorar

## Objetivo

Permitir encontrar y elegir una historia sin recorrer una página que mezcla catálogos, narraciones completas, rutas y canales.

## Implementación

1. Convertir Explorar en tres vistas: Casos, Recorridos y Canales. Casos es la vista inicial.
2. Unificar los expedientes publicados de Sanity, los trece relatos editoriales y la ficción del taxi en un catálogo. Conservar identificadores existentes para los favoritos.
3. Mostrar búsqueda, ciudad, fenómeno, disponibilidad de audio y favoritos antes de los resultados. Normalizar variantes de la misma ciudad.
4. Mostrar seis tarjetas inicialmente, con imagen, título, ciudad, resumen de dos líneas y etiquetas editoriales. Permitir mostrar más resultados y abrir un caso aleatorio de la selección actual.
5. Mover el texto completo y audio del taxi a una página propia. Mantener una tarjeta destacada compacta y el ancla anterior `expediente-noche`.
6. Crear páginas internas para los relatos editoriales que conserven sus textos y fuentes. Presentar testimonios, leyendas y ficción con etiquetas claras.
7. Mantener las rutas y paradas de La Candelaria en Recorridos, y los cuatro enlaces de TikTok en Canales.

## Criterios de revisión

- El buscador incluye relatos editoriales y expedientes de Sanity.
- La combinación de filtros determina resultados y selección aleatoria.
- Los favoritos conservan compatibilidad con la clave de almacenamiento existente.
- Las páginas nuevas tienen enlaces compartibles válidos; el audio del taxi conserva su URL.
- Las vistas permiten navegación por teclado, tienen estados vacíos comprensibles y funcionan en pantallas pequeñas.
- Una falla de Sanity muestra un aviso y permite acceder al contenido editorial local.
- La compilación pasa y la versión publicada muestra la nueva navegación.

## Alcance

Cambios de organización, navegación y presentación en el frontend. Sin migraciones de Sanity ni nuevas narraciones o datos sobre los casos.

## Validación realizada

- Compilación de producción correcta, incluidas las catorce páginas nuevas de relatos.
- Revisión en navegador: 19 registros, seis tarjetas iniciales y expansión del catálogo.
- Búsqueda de un relato editorial; filtro OVNI con tres resultados; Bogotá con ocho resultados; Bogotá y audio con tres resultados.
- Guardar el taxi desde su página y encontrarlo en Favoritos; eliminar el favorito de prueba y comprobar el estado vacío.
- Navegación por teclado entre vistas y enlaces a los recorridos y canales.
- Página editorial y texto completo del taxi accesibles en sus rutas nuevas.
- Vista móvil de 390 px sin desbordamiento horizontal.
