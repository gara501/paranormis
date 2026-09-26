# Paranormis

Interfaz en español para explorar reportes de actividad paranormal. Este repositorio conserva las páginas, consultas y lógica del sitio Bestiary, con una identidad visual de investigación tecnológica.

## Configuración

1. Instala Node.js 22.12 o superior.
2. Copia `.env.example` a `.env`.
3. Configura `PUBLIC_SANITY_PROJECT_ID` y `PUBLIC_SANITY_DATASET` para el dataset `production`.
4. Configura `SANITY_WRITE_TOKEN` con permisos para crear reportes y subir archivos de audio en ese dataset.
5. Instala dependencias con `npm install` y arranca con `npm run dev`.

El identificador del proyecto y el dataset se usan en el cliente de lectura y en el cliente de escritura. Nunca expongas el token en variables `PUBLIC_`.

## Desarrollo

```sh
npm run dev
npm run build
```

## Despliegue

La aplicación usa Astro con salida server y adaptador de Vercel para las rutas de envío de reportes. Configura las tres variables de entorno en el proyecto de despliegue.
