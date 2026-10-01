/**
 * The version this server was built from, to check whether a deploy went live:
 * `curl https://shop.kooperative.de/api/version`. Never cached — a stale answer
 * from a proxy would defeat the purpose.
 */
export default defineEventHandler((event) => {
  const { appVersion, buildTime } = useRuntimeConfig(event).public
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { version: appVersion, builtAt: buildTime }
})
