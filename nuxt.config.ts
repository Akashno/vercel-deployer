export default defineNuxtConfig({
  compatibilityDate: '2025-11-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxt/icon'],
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
  runtimeConfig: {
    // All Vercel / GitHub / Jira config now lives per-project inside PROJECTS (a JSON array).
    projects: process.env.PROJECTS ?? '',
    authUsername: process.env.AUTH_USERNAME ?? '',
    authPassword: process.env.AUTH_PASSWORD ?? '',
    authSecret: process.env.AUTH_SECRET ?? '',
    teamMembers: process.env.TEAM_MEMBERS ?? '',
  },
})