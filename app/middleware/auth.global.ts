export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login') return
  const authOk = useCookie('auth_ok')
  if (!authOk.value) {
    return navigateTo('/login')
  }
})
