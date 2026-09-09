/**
 * Consent for technically necessary cookies / localStorage.
 * Until the user accepts, no cart data may be persisted.
 * The consent flag itself is written via raw localStorage.
 */

const CONSENT_KEY = 'kooperative-consent-v1'

const consentGiven = ref(false)
const showBanner = ref(false)

let initialized = false
let pendingAction: (() => void) | null = null

function init() {
  // import.meta.server is a build-time constant and false in the client build
  // the unit suite runs, so only the `initialized` half is reachable here.
  /* v8 ignore start */
  if (initialized || import.meta.server) return
  /* v8 ignore stop */
  initialized = true
  try {
    consentGiven.value = localStorage.getItem(CONSENT_KEY) === 'true'
  } catch {
    consentGiven.value = false
  }
}

function require(action?: () => void): boolean {
  init()
  if (consentGiven.value) {
    action?.()
    return true
  }
  pendingAction = action ?? null
  showBanner.value = true
  return false
}

function accept() {
  try {
    localStorage.setItem(CONSENT_KEY, 'true')
  } catch {
    // Consent still applies to this session even if it cannot be persisted.
  }
  consentGiven.value = true
  showBanner.value = false
  const action = pendingAction
  pendingAction = null
  action?.()
}

function decline() {
  showBanner.value = false
  pendingAction = null
}

export function useConsent() {
  init()
  return {
    consentGiven: readonly(consentGiven),
    showBanner: readonly(showBanner),
    require,
    accept,
    decline,
  }
}
