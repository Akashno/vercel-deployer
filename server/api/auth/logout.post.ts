export default defineEventHandler((event) => {
  deleteCookie(event, AUTH_COOKIE, { path: '/' })
  deleteCookie(event, AUTH_FLAG_COOKIE, { path: '/' })
  return { ok: true }
})
