import { legalSlugParam, versionIdParam } from '../../../../../../../utils/legalRequest'
import { activateLegalVersion } from '../../../../../../../utils/legalText'

/**
 * Puts a version live — in both shops at once, since both read the same pointer.
 * Rolling back is the same call with an older version.
 */
export default defineEventHandler(async (event) => {
  const slug = legalSlugParam(event)
  const id = versionIdParam(event)
  const ok = await activateLegalVersion(useDB(), slug, id, getAdminUser(event) || 'admin', {
    remoteIp: getRequestIP(event, { xForwardedFor: true }),
  })
  if (!ok) throw createError({ statusCode: 404, statusMessage: 'Version nicht gefunden' })
  return { ok: true, slug, versionId: id }
})
