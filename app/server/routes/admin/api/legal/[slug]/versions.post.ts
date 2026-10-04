import { findPlaceholders } from '../../../../../utils/legalMarkdown'
import { legalSlugParam, readLegalMarkdown } from '../../../../../utils/legalRequest'
import { createLegalVersion } from '../../../../../utils/legalText'

/**
 * Saves the edited text as a new version. Never live on creation — going live
 * is a separate, deliberate step (versions/[id]/activate).
 */
export default defineEventHandler(async (event) => {
  const slug = legalSlugParam(event)
  const body = await readBody(event)
  const bodyMd = readLegalMarkdown(body)
  const rawNote = (body as { note?: unknown }).note
  const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, 500) : ''

  try {
    const created = await createLegalVersion(
      useDB(),
      { slug, bodyMd, note, createdBy: getAdminUser(event) || 'admin' },
      { remoteIp: getRequestIP(event, { xForwardedFor: true }) },
    )
    return { ...created, placeholders: findPlaceholders(bodyMd) }
  } catch (err) {
    // Two saves raced for the same version number; the unique key caught it.
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw createError({
        statusCode: 409,
        statusMessage:
          'Gleichzeitig wurde eine andere Version gespeichert – bitte erneut speichern',
      })
    }
    throw err
  }
})
