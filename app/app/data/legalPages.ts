/**
 * The legal pages, in the order the legal dialog lists them.
 *
 * Shared by client and server: the slugs are the keys of the texts in
 * `koop_legal_text_*`, the routes the standalone pages under app/pages/, and the
 * titles the headings both shops print above the text (the old shop's patches in
 * legacy-shop/ carry their own copy of the titles).
 */

export type LegalSlug = 'impressum' | 'datenschutz' | 'agb' | 'widerruf' | 'versand'

export interface LegalPage {
  slug: LegalSlug
  /** Heading above the text and page title. */
  title: string
  /** Short label for menus and tabs. */
  label: string
  /** Standalone route, so links work without JavaScript and can be shared. */
  path: string
  /** Meta description of the standalone page. */
  description: string
}

export const LEGAL_PAGES: readonly LegalPage[] = [
  {
    slug: 'impressum',
    title: 'Impressum',
    label: 'Impressum',
    path: '/impressum',
    description: 'Impressum der Kooperative Dürnau.',
  },
  {
    slug: 'datenschutz',
    title: 'Datenschutzerklärung',
    label: 'Datenschutz',
    path: '/datenschutz',
    description: 'Datenschutzerklärung der Kooperative Dürnau.',
  },
  {
    slug: 'agb',
    title: 'Allgemeine Geschäftsbedingungen',
    label: 'AGB',
    path: '/agb',
    description: 'Allgemeine Geschäftsbedingungen für Bestellungen bei der Kooperative Dürnau.',
  },
  {
    slug: 'widerruf',
    title: 'Widerrufsbelehrung',
    label: 'Widerruf',
    path: '/widerruf',
    description: 'Widerrufsbelehrung und Muster-Widerrufsformular der Kooperative Dürnau.',
  },
  {
    slug: 'versand',
    title: 'Versand & Zahlung',
    label: 'Versand & Zahlung',
    path: '/versand',
    description: 'Versandkosten, Lieferzeiten und Zahlungsarten der Kooperative Dürnau.',
  },
]

export function isLegalSlug(value: unknown): value is LegalSlug {
  return LEGAL_PAGES.some((p) => p.slug === value)
}

export function legalPage(slug: LegalSlug): LegalPage {
  // isLegalSlug guards every caller, so the lookup cannot miss.
  return LEGAL_PAGES.find((p) => p.slug === slug)!
}
