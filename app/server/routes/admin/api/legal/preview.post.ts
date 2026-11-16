import { findPlaceholders, renderLegalMarkdown } from '../../../../utils/legalMarkdown'
import { readLegalMarkdown } from '../../../../utils/legalRequest'

/**
 * Renders Markdown exactly as saving would, without saving. The editor's preview
 * goes through here so that what the operator sees is what both shops will print.
 */
export default defineEventHandler(async (event) => {
  const bodyMd = readLegalMarkdown(await readBody(event))
  return { html: renderLegalMarkdown(bodyMd), placeholders: findPlaceholders(bodyMd) }
})
