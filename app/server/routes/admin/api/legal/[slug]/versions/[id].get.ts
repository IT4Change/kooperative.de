import { legalSlugParam, versionIdParam } from '../../../../../../utils/legalRequest'
import { getLegalVersion } from '../../../../../../utils/legalText'

/** One version with its Markdown (for editing) and rendered HTML (for viewing). */
export default defineEventHandler(async (event) => {
  const slug = legalSlugParam(event)
  const id = versionIdParam(event)
  const version = await getLegalVersion(useDB(), slug, id)
  if (!version) throw createError({ statusCode: 404, statusMessage: 'Version nicht gefunden' })
  return version
})
