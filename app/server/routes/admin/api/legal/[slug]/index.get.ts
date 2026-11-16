import { legalPage } from '../../../../../../app/data/legalPages'
import { legalSlugParam } from '../../../../../utils/legalRequest'
import { listLegalVersions } from '../../../../../utils/legalText'

/** All versions of one legal page, newest first, with the live one marked. */
export default defineEventHandler(async (event) => {
  const slug = legalSlugParam(event)
  return {
    slug,
    title: legalPage(slug).title,
    versions: await listLegalVersions(useDB(), slug),
  }
})
