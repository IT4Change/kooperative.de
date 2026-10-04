import type { LegalSlug } from '~/data/legalPages'

/**
 * State of the legal dialog: which page it shows, or null while it is closed.
 * A single instance for the whole app (useState), so a link anywhere — header,
 * footer, cookie notice, checkout — opens the same dialog on the right tab.
 */
export function useLegal() {
  const current = useState<LegalSlug | null>('legal-dialog', () => null)

  return {
    current: readonly(current),
    isOpen: computed(() => current.value !== null),
    open(slug: LegalSlug) {
      current.value = slug
    },
    close() {
      current.value = null
    },
  }
}
