/**
 * Loads the next page once a sentinel element comes close to the viewport.
 *
 * Deliberately additive: the "Mehr anzeigen" button stays in place. It is the
 * fallback when IntersectionObserver is unavailable, and it keeps the feature
 * reachable by keyboard and screen reader, where "scroll further" is not an
 * available gesture.
 *
 * The sentinel is expected to live behind the same `v-if` as the button: when
 * there is nothing left to load it unmounts, the ref goes undefined and the
 * observer is torn down.
 */
export function useInfiniteScroll(
  target: Ref<HTMLElement | undefined>,
  load: () => void,
  /** Starts loading this far before the sentinel actually reaches the viewport. */
  rootMargin = '600px',
) {
  let observer: IntersectionObserver | null = null

  function disconnect() {
    observer?.disconnect()
    observer = null
  }

  function observe(element: HTMLElement | undefined) {
    disconnect()
    // No element (nothing left to load) or no browser support — the button
    // remains the way forward in both cases.
    if (!element || typeof IntersectionObserver === 'undefined') return

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load()
      },
      { rootMargin },
    )
    observer.observe(element)
  }

  // Runs on the server too, where the ref is undefined and IntersectionObserver
  // does not exist, so observe() returns immediately.
  watch(target, observe, { immediate: true })
  onBeforeUnmount(disconnect)
}
