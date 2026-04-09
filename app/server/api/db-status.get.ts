export default defineEventHandler(async () => {
  try {
    const db = useDB()
    const [rows] = await db.query('SELECT 1 AS ok')
    return { connected: true, result: rows }
  } catch (error: any) {
    return { connected: false, error: error.message }
  }
})
