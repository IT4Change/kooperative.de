/**
 * Canonical order lifecycle (the "happy path" shown in the admin stepper).
 * osCommerce status ids: 1 In Bearbeitung · 4 Vorkasse erwartet · 2 Versandbereit · 3 Versendet.
 * The state machine is freely operable — the operator may set any status; this
 * array only drives the VISUALISATION order.
 */
export const ORDER_STATUS_FLOW: number[] = [1, 4, 2, 3]

/** Synthetic id of the new-shop confirmation step, which has no osCommerce status. */
export const CONFIRMATION_STEP_ID = -1

export interface FlowStep {
  id: number
  name: string
  state: 'done' | 'current' | 'upcoming' | 'skipped'
  visitedAt: string | null
  /** Sub-label shown where the date would sit, for a step that carries no date. */
  note?: string
}

interface HistoryEntry {
  statusId: number
  dateAdded: string | Date | null
}

/**
 * Build the osCommerce part of the stepper: mark the current status, everything
 * the order already went through (or that lies before the current step in the
 * canonical order) as done, and the remaining steps as upcoming. A current
 * status outside the canonical flow is appended so it is always represented.
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
    return {
      id,
      name: statusNames.get(id) ?? `Status ${id}`,
      state,
      visitedAt: firstVisit.get(id) ?? null,
    }
  })
}

/** How the confirmation step stands for a given order or pending confirmation. */
export type ConfirmationState = 'done' | 'current' | 'skipped'

const CONFIRMATION_LABEL: Record<ConfirmationState, string> = {
  done: 'Bestätigt',
  current: 'Bestätigung ausstehend',
  skipped: 'Bestätigung',
}

/**
 * The new-shop confirmation step. 'skipped' covers an order that came through
 * the old shop, where no customer confirmation was ever foreseen — it is shown
 * greyed out rather than omitted, see buildFullFlow().
 */
export function confirmationStep(state: ConfirmationState, visitedAt: string | null): FlowStep {
  return {
    id: CONFIRMATION_STEP_ID,
    name: CONFIRMATION_LABEL[state],
    state,
    visitedAt,
    ...(state === 'skipped' ? { note: 'entfällt' } : {}),
  }
}

/**
 * The complete stepper as both admin views render it.
 *
 * The confirmation step is ALWAYS the first one, including for old-shop orders
 * that never had one. That is what keeps the numbering identical across all
 * three views — a pending confirmation, a new-shop order and an old-shop order
 * all show "In Bearbeitung" as step 2. Leaving the step out for the old shop is
 * what made the same status appear as step 1 in one view and step 2 in another.
 *
 * `currentStatusId` is null while no osCommerce order exists yet (a pending
 * confirmation): the osCommerce part is then entirely upcoming.
 */
export function buildFullFlow(args: {
  confirmation: { state: ConfirmationState; visitedAt: string | null }
  currentStatusId: number | null
  statusNames: Map<number, string>
  history: HistoryEntry[]
}): FlowStep[] {
  const { confirmation, currentStatusId, statusNames, history } = args
  const steps =
    currentStatusId === null
      ? ORDER_STATUS_FLOW.map((id) => ({
          id,
          name: statusNames.get(id) ?? `Status ${id}`,
          state: 'upcoming' as const,
          visitedAt: null,
        }))
      : buildStatusFlow(currentStatusId, statusNames, history)

  return [confirmationStep(confirmation.state, confirmation.visitedAt), ...steps]
}
