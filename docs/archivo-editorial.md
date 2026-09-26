# Paranormis: publicación editorial

## Publicar un expediente

1. Trabajar desde el Studio de `backend`, proyecto `en0s05um`, dataset `production`.
2. Mantener el documento como borrador durante la preparación. Este dataset es público: la casilla de aprobación es un filtro de la aplicación, no un control de confidencialidad para documentos ya publicados.
3. Añadir título, ciudad, entidad, región, ubicación y precisión cartográfica. Registrar una fuente HTTPS y distinguir fecha del evento, periodo aproximado y fecha de publicación.
4. Resumir y atribuir el relato con palabras propias. No inventar testigos, fechas, coordenadas exactas ni evidencias. Documentar discrepancias en «Aclaraciones sobre la fecha».
5. Revisar datos personales y derechos de imágenes/audio. Marcar «Aprobado para publicar» y publicar. La aprobación editorial no demuestra una causa paranormal.
6. Para retirar un expediente, usar **Despublicar**. Desmarcar la casilla en un borrador no cambia la versión publicada.

El sitio solo consulta avistamientos publicados con `editorialApproved == true`; aplica el mismo filtro a mapa, archivo, búsqueda, páginas de expedientes y tarjetas.

## Funciones públicas

- `/explorar`: búsqueda por ciudad, entidad y título; filtro de favoritos del dispositivo; selección diaria.
- `/expedientes/:id`: relato, base de la fecha, fuentes, enlace al mapa, favoritos, compartir, tarjeta PNG y lectura opcional con voz del dispositivo.
- `/recorridos/bogota`: recorrido virtual por los expedientes publicados de Bogotá, con transcripción visible.
- `/tarjetas/:id.png`: imagen social generada a partir de contenido editorial; `?download=1` permite descargarla.
- Los favoritos viven en localStorage. No requieren cuentas ni se envían a Sanity.
- La voz depende de las capacidades del navegador/dispositivo; nunca se reproduce automáticamente.
- `/report` redirige al archivo. Las antiguas APIs de envío y cálculo responden 410 para todos los métodos y no procesan el cuerpo de la solicitud.

## Entornos y despliegue

El frontend necesita únicamente `PUBLIC_SANITY_PROJECT_ID` y `PUBLIC_SANITY_DATASET`. El token `SANITY_WRITE_TOKEN` se conserva en `backend/.env`, excluido de Git, para las herramientas editoriales. No revocarlo sin revisar otros consumidores del proyecto.

Por decisión del propietario, `SANITY_WRITE_TOKEN` se conserva en Vercel (Production y Preview). No eliminarlo ni revocarlo: también se utiliza en Bestiary. El frontend actual no lo consume y sus APIs de escritura responden 410. Los despliegues históricos conservan su código anterior; retirar o proteger esas versiones requiere una gestión separada. No restaurar una versión que reactive los aportes públicos.

Publicar también el Studio actualizado con `npm run deploy` desde `backend` en el hostname correspondiente a Paranormis. No sustituir el Studio de Apex Bestiary.

## Caso del Gaitán

Se incorporó «El excavador del Gaitán» a partir de [Idartes](https://www.idartes.gov.co/en/node/13738), con fecha de publicación 11 de junio de 2020. Idartes sitúa el relato en agosto de 2002; [Infobae](https://www.infobae.com/colombia/2024/10/31/los-misterios-paranormales-de-bogota-las-historias-que-transitan-las-calles/) menciona 2003. La discrepancia queda visible y no se inventa un día del evento. El punto indica el edificio como referencia aproximada.

La monja de la calle 100 ya estaba registrada: no se duplicó. G66 y L’Angolo no se incorporaron como avistamientos individuales documentados.

El script `backend/scripts/publish-editorial-cases.mjs` identifica solo los cuatro casos previamente investigados por sus URLs y evita duplicar el caso nuevo. Admite `--dry-run`. Requiere cargar el token privado del backend en el entorno de ejecución.
