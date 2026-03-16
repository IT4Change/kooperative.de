export type CategorySlug =
  | 'buecher'
  | 'papeterie'
  | 'medien'
  | 'sonett'
  | 'koerperpflege'
  | 'holz'
  | 'lebensmittel'
  | 'diverses'

export interface Category {
  slug: CategorySlug
  name: string
  description: string
}

export interface ProductVariant {
  size: string          // Anzeige: "250 ml", "1 kg"
  price: number         // 5.90
  amount: number        // 0.25 (in Bezugseinheit)
  referenceUnit: string // "L" oder "kg"
  image: string         // Bild dieser Gebindegröße
}

export interface Product {
  id: string
  name: string
  price: number
  description: string
  category: CategorySlug
  unit?: string
  images: readonly string[]
  variants?: readonly ProductVariant[]
}

export interface CartItem {
  product: Product
  quantity: number
  variantIndex?: number
}

export function unitPrice(variant: ProductVariant): number {
  return variant.price / variant.amount
}

export interface OrderFormData {
  name: string
  street: string
  zip: string
  city: string
  email: string
  phone: string
  notes: string
}

export const categories: Category[] = [
  { slug: 'buecher', name: 'Bücher', description: 'Kooperative, Andere, Gebrauchte, Kataloge, Karten, Noten' },
  { slug: 'papeterie', name: 'Papeterie', description: 'Notizblöcke, Postkarten, Poster' },
  { slug: 'medien', name: 'Medien', description: 'Texte, Sprache, Filme, Musik' },
  { slug: 'sonett', name: 'Sonett', description: 'Wäsche, Geschirr, Putzmittel' },
  { slug: 'koerperpflege', name: 'Körperpflege', description: 'Gesicht, Haut & Haare, Hand & Fuss, Bad & Dusche' },
  { slug: 'holz', name: 'Holz', description: 'Spiele, Türen, Stühle, Särge' },
  { slug: 'lebensmittel', name: 'Lebensmittel', description: 'Aus der Kooperative' },
  { slug: 'diverses', name: 'Diverses', description: 'Weiteres aus dem Sortiment' },
]

function productImages(id: string): string[] {
  return [1, 2, 3].map(n => `https://picsum.photos/seed/${id}-${n}/400/300`)
}

export const products: Product[] = [
  // Bücher
  { id: 'b1', name: 'Gemeinschaft wagen', price: 18.00, description: 'Erfahrungen und Perspektiven aus der Kooperative Dürnau', category: 'buecher', images: productImages('b1') },
  { id: 'b2', name: 'Jahreskalender 2026', price: 12.50, description: 'Wandkalender mit Bildern aus Dürnau', category: 'buecher', images: productImages('b2') },
  { id: 'b3', name: 'Liederbuch', price: 14.00, description: 'Sammlung von Liedern aus der Gemeinschaft', category: 'buecher', images: productImages('b3') },

  // Papeterie
  { id: 'p1', name: 'Postkarten-Set Dürnau', price: 6.50, description: '8 Postkarten mit Motiven aus Dürnau', category: 'papeterie', images: productImages('p1') },
  { id: 'p2', name: 'Notizblock A5', price: 4.80, description: 'Recyclingpapier, 80 Blatt, liniert', category: 'papeterie', images: productImages('p2') },

  // Medien
  { id: 'm1', name: 'Dokumentarfilm DVD', price: 15.00, description: 'Leben in der Kooperative – ein Film', category: 'medien', images: productImages('m1') },
  { id: 'm2', name: 'Hörbuch: Vorträge', price: 10.00, description: 'Ausgewählte Vorträge als Audio-CD', category: 'medien', images: productImages('m2') },

  // Sonett
  {
    id: 's1', name: 'Waschmittel Lavendel', price: 8.90, description: 'Flüssiges Waschmittel mit Bio-Lavendelöl', category: 'sonett', unit: '1 L', images: productImages('s1'),
    variants: [
      { size: '1 L', price: 8.90, amount: 1, referenceUnit: 'L', image: `https://picsum.photos/seed/s1-1L/400/300` },
      { size: '2 L', price: 16.50, amount: 2, referenceUnit: 'L', image: `https://picsum.photos/seed/s1-2L/400/300` },
      { size: '5 L', price: 35.00, amount: 5, referenceUnit: 'L', image: `https://picsum.photos/seed/s1-5L/400/300` },
      { size: '10 L', price: 62.00, amount: 10, referenceUnit: 'L', image: `https://picsum.photos/seed/s1-10L/400/300` },
    ],
  },
  {
    id: 's2', name: 'Geschirrspülmittel', price: 4.50, description: 'Handspülmittel Calendula', category: 'sonett', unit: '300 ml', images: productImages('s2'),
    variants: [
      { size: '300 ml', price: 4.50, amount: 0.3, referenceUnit: 'L', image: `https://picsum.photos/seed/s2-300ml/400/300` },
      { size: '1 L', price: 11.90, amount: 1, referenceUnit: 'L', image: `https://picsum.photos/seed/s2-1L/400/300` },
      { size: '5 L', price: 46.00, amount: 5, referenceUnit: 'L', image: `https://picsum.photos/seed/s2-5L/400/300` },
    ],
  },
  {
    id: 's3', name: 'Allzweckreiniger', price: 5.20, description: 'Universalreiniger Citrus', category: 'sonett', unit: '500 ml', images: productImages('s3'),
    variants: [
      { size: '500 ml', price: 5.20, amount: 0.5, referenceUnit: 'L', image: `https://picsum.photos/seed/s3-500ml/400/300` },
      { size: '1 L', price: 9.40, amount: 1, referenceUnit: 'L', image: `https://picsum.photos/seed/s3-1L/400/300` },
      { size: '10 L', price: 72.00, amount: 10, referenceUnit: 'L', image: `https://picsum.photos/seed/s3-10L/400/300` },
    ],
  },

  // Körperpflege
  { id: 'k1', name: 'Handcreme Rose', price: 7.90, description: 'Pflegende Handcreme mit Rosenöl, 50 ml', category: 'koerperpflege', unit: '50 ml', images: productImages('k1') },
  { id: 'k2', name: 'Duschgel Lavendel', price: 6.50, description: 'Mildes Duschgel, 200 ml', category: 'koerperpflege', unit: '200 ml', images: productImages('k2') },

  // Holz
  { id: 'h1', name: 'Schneidebrett Buche', price: 24.00, description: 'Handgefertigtes Schneidebrett aus heimischer Buche', category: 'holz', images: productImages('h1') },
  { id: 'h2', name: 'Holzspielzeug Bauklötze', price: 32.00, description: 'Set mit 30 Bauklötzen aus Naturholz', category: 'holz', images: productImages('h2') },
  { id: 'h3', name: 'Kerzenständer', price: 18.50, description: 'Gedrechselter Kerzenständer aus Esche', category: 'holz', images: productImages('h3') },

  // Lebensmittel
  { id: 'l1', name: 'Honig aus Dürnau', price: 9.50, description: 'Blütenhonig aus eigener Imkerei, 500 g', category: 'lebensmittel', unit: '500 g', images: productImages('l1') },
  { id: 'l2', name: 'Apfelsaft naturtrüb', price: 4.20, description: 'Direktsaft von Streuobstwiesen, 1 Liter', category: 'lebensmittel', unit: '1 L', images: productImages('l2') },

  // Diverses
  { id: 'd1', name: 'Baumwolltasche Kooperative', price: 8.00, description: 'Bio-Baumwolle mit Kooperative-Logo', category: 'diverses', images: productImages('d1') },
  { id: 'd2', name: 'Geschenkgutschein', price: 25.00, description: 'Gutschein für den Kooperative-Shop', category: 'diverses', images: productImages('d2') },
]
