// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { findPlaceholders, renderLegalMarkdown, toAsciiEntities } from './legalMarkdown'

/**
 * The stored HTML goes straight into both shops — the new one via v-html, the
 * old one via echo. Everything that keeps that safe and readable happens in
 * this one function, so the tests aim at exactly those guarantees.
 */
describe('renderLegalMarkdown', () => {
  it('renders the constructs a legal text uses', () => {
    const html = renderLegalMarkdown('## Titel\n\n### Unter\n\n**fett**\n\n- a\n- b\n\n1. eins')

    expect(html).toContain('<h2>Titel</h2>')
    expect(html).toContain('<h3>Unter</h3>')
    expect(html).toContain('<strong>fett</strong>')
    expect(html).toContain('<ul>\n<li>a</li>')
    expect(html).toContain('<ol>\n<li>eins</li>')
  })

  it('turns a single line break into <br>, as an editor without Markdown habits expects', () => {
    expect(renderLegalMarkdown('Musterweg 1\n12345 Müllheim')).toBe(
      '<p>Musterweg 1<br>\n12345 M&#252;llheim</p>\n',
    )
  })

  it('demotes a top-level heading, because the page already has the <h1>', () => {
    expect(renderLegalMarkdown('# Groß')).toBe('<h2>Gro&#223;</h2>\n')
  })

  it('escapes raw HTML instead of passing it through', () => {
    const html = renderLegalMarkdown('<script>alert(1)</script> <b onclick="x">b</b>')

    expect(html).not.toContain('<script')
    expect(html).not.toContain('<b ')
    expect(html).toContain('&lt;script&gt;')
  })

  it('refuses javascript: links', () => {
    const html = renderLegalMarkdown('[klick](javascript:alert(1))')

    expect(html).not.toContain('href')
  })

  it('renders no images — they would be third-party requests on every view', () => {
    expect(renderLegalMarkdown('![x](https://tracker.example/p.gif)')).not.toContain('<img')
  })

  it('keeps the referrer from external sites, but not from mail links', () => {
    expect(renderLegalMarkdown('[a](https://example.org)')).toContain(
      '<a href="https://example.org" rel="noopener noreferrer">a</a>',
    )
    expect(renderLegalMarkdown('[m](mailto:info@example.org)')).toBe(
      '<p><a href="mailto:info@example.org">m</a></p>\n',
    )
  })

  it('links spelled-out addresses, but leaves a bare domain in the text alone', () => {
    expect(renderLegalMarkdown('Shop example.org, Mail info@example.org, https://x.de')).toBe(
      '<p>Shop example.org, Mail <a href="mailto:info@example.org">info@example.org</a>, ' +
        '<a href="https://x.de" rel="noopener noreferrer">https://x.de</a></p>\n',
    )
  })

  it('wraps tables so a wide one scrolls on its own', () => {
    const html = renderLegalMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')

    expect(html).toMatch(/^<div class="legal-table"><table>\n/)
    expect(html).toMatch(/<\/table><\/div>\n$/)
  })

  it('marks open placeholders', () => {
    expect(renderLegalMarkdown('Hoster: [[Name]]')).toBe(
      '<p>Hoster: <mark class="legal-placeholder">[[Name]]</mark></p>\n',
    )
  })

  it('produces pure ASCII, whatever the text contains', () => {
    // eslint-disable-next-line no-control-regex
    expect(renderLegalMarkdown('„Grüße“ – 5 € 🌻')).toMatch(/^[\x00-\x7F]*$/)
  })
})

describe('toAsciiEntities', () => {
  it('encodes by code point, so characters beyond the BMP stay one entity', () => {
    expect(toAsciiEntities('ä€🌻a')).toBe('&#228;&#8364;&#127803;a')
  })
})

describe('findPlaceholders', () => {
  it('lists each placeholder once, in order, trimmed', () => {
    expect(findPlaceholders('[[ B ]] x [[A]] y [[B]]')).toStrictEqual(['B', 'A'])
  })

  it('finds nothing in a finished text', () => {
    expect(findPlaceholders('[Link](https://x.de) [x]')).toStrictEqual([])
  })
})
