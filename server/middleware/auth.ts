export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/') || path.startsWith('/api/auth/')) return

  const ok = await verifyAuthCookie(event)
  if (!ok) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
})
