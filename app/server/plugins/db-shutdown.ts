export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', async () => {
    const { closeDB } = await import('../utils/db')
    await closeDB()
  })
})
