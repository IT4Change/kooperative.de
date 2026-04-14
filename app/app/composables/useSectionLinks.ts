export interface SectionLink {
  id: string
  label: string
  href: string
}

const links: SectionLink[] = [
  { id: 'arbeit', label: 'Arbeit', href: 'https://www.kooperative.de/Betriebe/betriebe.html' },
  { id: 'kultur', label: 'Kultur', href: 'https://www.ferchervonsteinwand.org/' },
  { id: 'bildung', label: 'Bildung', href: 'https://www.dorf-uni.de/' },
  { id: 'gaeste', label: 'Gäste', href: 'https://www.kooperative.de/soziales/soziales.html' },
]

export function useSectionLinks(): SectionLink[] {
  return links
}

export const KONTAKT_URL = 'https://shop.kooperative.de/kontakt.php'
export const HISTORIE_URL = 'https://www.kooperative.de/html/sd/ueberuns.html'
