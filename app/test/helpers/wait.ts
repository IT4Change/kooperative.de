/**
 * Polling helpers for things that finish on their own schedule.
 *
 * A router navigation loads the page chunk of its target, and a $fetch goes
 * through the fake Nitro server — how many ticks either takes depends on
 * machine load, so a fixed `setTimeout` is a flake waiting to happen. These
 * helpers wait for the outcome instead and fail with a readable message when it
 * never arrives.
 */
const DEFAULT_TIMEOUT = Number(process.env.TEST_WAIT_TIMEOUT ?? 5000)

export async function waitFor(
  predicate: () => boolean,
  description = 'condition',
  timeout = DEFAULT_TIMEOUT,
): Promise<void> {
  const deadline = Date.now() + timeout
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeout} ms waiting for ${description}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

/** Waits until the rendered text contains `needle`. */
export async function waitForText(
  wrapper: { text: () => string },
  needle: string,
  timeout?: number,
): Promise<void> {
  await waitFor(() => wrapper.text().includes(needle), `text ${JSON.stringify(needle)}`, timeout)
}
