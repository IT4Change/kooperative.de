import { isLegalSlug, legalPage } from '../../../app/data/legalPages'
import { getLiveLegalText } from '../../utils/legalText'

/**
 * The live version of a legal text, as HTML ready to print.
 *
 * Answers 200 for every known page, also when there is no text to show (none
 * activated yet, database unreachable): `html` is null then and the page says
 * the text is temporarily unavailable. The texts themselves are not part of
 * this repository — they are imported into the database
 * (scripts/legal-import.mjs) and edited in the admin.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!isLegalSlug(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Unbekannte Seite' })
  }
  const { title } = legalPage(slug)
  try {
    const live = await getLiveLegalText(useDB(), slug)
    if (live) {
      return {
        slug,
        title,
        html: live.html,
        versionNo: live.versionNo,
        activatedAt: live.activatedAt,
      }
    }
  } catch (err) {
    console.warn(`[legal] ${slug}: database unavailable:`, err)
  }
  return { slug, title, html: null, versionNo: null, activatedAt: null }
})
