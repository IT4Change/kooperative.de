export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', async () => {
    const { pool } = await import('../utils/db')
    await pool?.end()
  })
})
