/**
 * Shared formatting helpers for the admin views.
 */
export function useAdminFormat() {
  const euro = (n: number | null | undefined): string => {
    if (n == null) return '–'
    return `${n.toFixed(2).replace('.', ',')} €`
  }

  const dateTime = (v: string | null | undefined): string => {
    if (!v) return '–'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const date = (v: string | null | undefined): string => {
    if (!v) return '–'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  /** Tailwind classes for an orders_status id (matches osCommerce status ids). */
  const statusClass = (id: number): string => {
    switch (id) {
      case 1: return 'bg-amber-100 text-amber-800'   // In Bearbeitung
      case 2: return 'bg-blue-100 text-blue-800'     // Versandbereit
      case 3: return 'bg-green-100 text-green-800'   // Versendet
      case 4: return 'bg-purple-100 text-purple-800' // Vorkasse erwartet
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return { euro, dateTime, date, statusClass }
}
