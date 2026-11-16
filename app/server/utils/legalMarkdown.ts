import MarkdownIt from 'markdown-it'

/**
 * Markdown → HTML for the legal texts.
 *
 * The HTML is rendered once, when a version is saved, and stored next to the
 * Markdown. Both shops print the stored HTML as is — the old PHP shop has no
 * Markdown parser — so everything that makes it safe and portable happens here:
 *
 *   - Raw HTML in the Markdown is escaped, not passed through (`html: false`),
 *     and markdown-it refuses javascript:/vbscript:/file:/data: links. What
 *     comes out contains only tags markdown-it itself generates.
 *   - Images are switched off: a legal text has no use for them, and an image
 *     URL is a request to a third party on every page view.
 *   - Every non-ASCII character becomes a numeric entity. The result is pure
 *     ASCII and survives any connection or page charset — the old shop runs on
 *     ISO-8859-1, the new one on UTF-8.
 *   - [[Placeholders]] are wrapped in <mark>, so a text activated with an open
 *     placeholder is at least visibly incomplete instead of quietly wrong.
 */

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false })
md.disable('image')
// Only spelled-out URLs and e-mail addresses become links. Without this every
// "kooperative.de" in the running text would turn into an http:// link.
md.linkify.set({ fuzzyLink: false })

// The page prints the title as <h1>; a "# Heading" in the text must not compete.
md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  if (token.tag === 'h1') token.tag = 'h2'
  return self.renderToken(tokens, idx, options)
}
md.renderer.rules.heading_close = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  if (token.tag === 'h1') token.tag = 'h2'
  return self.renderToken(tokens, idx, options)
}

// Wide tables scroll inside their own box instead of widening the page.
md.renderer.rules.table_open = () => '<div class="legal-table"><table>\n'
md.renderer.rules.table_close = () => '</table></div>\n'

// Links to other sites do not get to see where the reader came from.
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  // markdown-it sets href on every link token it emits.
  if (/^https?:/i.test(token.attrGet('href')!)) {
    token.attrSet('rel', 'noopener noreferrer')
  }
  return self.renderToken(tokens, idx, options)
}

const PLACEHOLDER = /\[\[([^\]]+)\]\]/g

/** Every distinct [[placeholder]] in a text, in order of first appearance. */
export function findPlaceholders(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(PLACEHOLDER)].map((m) => m[1].trim()))]
}

/** Replaces every non-ASCII character with its numeric HTML entity. */
export function toAsciiEntities(html: string): string {
  let ascii = ''
  // for…of walks code points, so characters outside the BMP stay one entity.
  for (const ch of html) {
    const codePoint = ch.codePointAt(0)!
    ascii += codePoint > 0x7f ? `&#${codePoint};` : ch
  }
  return ascii
}

export function renderLegalMarkdown(markdown: string): string {
  const html = md
    .render(markdown)
    .replace(PLACEHOLDER, (all) => `<mark class="legal-placeholder">${all}</mark>`)
  return toAsciiEntities(html)
}
