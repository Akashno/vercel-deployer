import { AUTH_COOKIE, isSuperAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const cookieVal = getCookie(event, AUTH_COOKIE)
  if (!cookieVal) {
    return { email: '', isAdmin: false }
  }

  const separatorIndex = cookieVal.indexOf(':')
  if (separatorIndex === -1) {
    return { email: '', isAdmin: false }
  }

  const username = cookieVal.substring(0, separatorIndex)
  const isAdmin = await isSuperAdmin(event)

  return {
    email: username,
    isAdmin
  }
})
