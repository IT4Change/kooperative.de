/**
 * ISO-2 → osCommerce country_id mapping (verified against the DB).
 */
export const COUNTRY_IDS: Record<'DE' | 'AT' | 'CH', { id: number, name: string }> = {
  DE: { id: 81, name: 'Deutschland' },
  AT: { id: 14, name: 'Oesterreich' },
  CH: { id: 204, name: 'Schweiz' },
}
