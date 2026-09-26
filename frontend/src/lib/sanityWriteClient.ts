import {createClient} from '@sanity/client'

/**
 * Write-enabled client. Uses a server-only token — never import this file
 * from client-side/browser code, only from Astro API routes (src/pages/api/*)
 * which run on the server.
 */
export const sanityWriteClient = createClient({
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: import.meta.env.PUBLIC_SANITY_DATASET,
  apiVersion: '2024-01-01',
  useCdn: false,
  token: import.meta.env.SANITY_WRITE_TOKEN,
})
