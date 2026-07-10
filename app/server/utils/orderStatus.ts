/**
 * Canonical order lifecycle (the "happy path" shown in the admin stepper).
 * osCommerce status ids: 1 In Bearbeitung · 4 Vorkasse erwartet · 2 Versandbereit · 3 Versendet.
 * The state machine is freely operable — the operator may set any status; this
 * array only drives the VISUALISATION order. (New-shop "Bestätigung ausstehend"
 * gets prepended here once Phase 3 lands.)
 */
export const ORDER_STATUS_FLOW: number[] = [1, 4, 2, 3]

export interface FlowStep {
  id: number
  name: string
  state: 'done' | 'current' | 'upcoming'
  visitedAt: string | null
}

interface HistoryEntry {
  statusId: number
  dateAdded: string | Date | null
}

/**
 * Build the stepper: mark the current status, everything the order already went
 * through (or that lies before the current step in the canonical order) as done,
 * and the remaining steps as upcoming. A current status outside the canonical
 * flow is appended so it is always represented.
 */
export function buildStatusFlow(
  currentStatusId: number,
  statusNames: Map<number, string>,
  history: HistoryEntry[],
): FlowStep[] {
  const ids = [...ORDER_STATUS_FLOW]
  if (!ids.includes(currentStatusId)) ids.push(currentStatusId)
  const currentIndex = ids.indexOf(currentStatusId)

  const firstVisit = new Map<number, string>()
  for (const h of history) {
    if (h.dateAdded == null) continue
    const iso = typeof h.dateAdded === 'string' ? h.dateAdded : new Date(h.dateAdded).toISOString()
    if (!firstVisit.has(h.statusId)) firstVisit.set(h.statusId, iso)
  }

  return ids.map((id, i) => {
    // Position-based along the canonical flow: everything before the current
    // step is "done", the current step is highlighted, the rest is "upcoming".
    // (Robust against manual backward moves — no green connector into a future step.)
    let state: FlowStep['state']
    if (id === currentStatusId) state = 'current'
    else if (currentIndex >= 0 && i < currentIndex) state = 'done'
    else state = 'upcoming'
    return { id, name: statusNames.get(id) ?? `Status ${id}`, state, visitedAt: firstVisit.get(id) ?? null }
  })
}
