<script setup lang="ts">
definePageMeta({ layout: false })

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await navigateTo('/')
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message
    error.value = msg ?? 'Invalid credentials'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">Deployments</h1>
      <p class="login-sub">Sign in to continue</p>

      <form class="login-form" @submit.prevent="submit">
        <div class="field">
          <label class="label" for="username">Username</label>
          <input
            id="username"
            v-model="username"
            class="input"
            type="text"
            autocomplete="username"
            placeholder="username"
            :disabled="loading"
            required
          />
        </div>

        <div class="field">
          <label class="label" for="password">Password</label>
          <input
            id="password"
            v-model="password"
            class="input"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :disabled="loading"
            required
          />
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button class="submit-btn" type="submit" :disabled="loading">
          <span v-if="loading" class="spinner" />
          <span>{{ loading ? 'Signing in…' : 'Sign in' }}</span>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  align-items: center;
  background: #000;
  display: flex;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem;
}

.login-card {
  background: #080808;
  border: 1px solid #1a1a1a;
  border-radius: 10px;
  padding: 2rem;
  width: 100%;
  max-width: 360px;
}

.login-title {
  color: #fff;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 0.25rem;
}

.login-sub {
  color: #555;
  font-size: 0.875rem;
  margin-bottom: 1.75rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.label {
  color: #777;
  font-size: 0.8125rem;
}

.input {
  background: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: #ededed;
  font-size: 0.9375rem;
  outline: none;
  padding: 0.5rem 0.75rem;
  transition: border-color 0.15s;
  width: 100%;
}

.input:focus { border-color: #555; }
.input::placeholder { color: #333; }
.input:disabled { opacity: 0.5; }

.error-msg {
  background: rgba(229, 72, 77, 0.08);
  border: 1px solid rgba(229, 72, 77, 0.2);
  border-radius: 6px;
  color: #e5484d;
  font-size: 0.8125rem;
  padding: 0.5rem 0.75rem;
}

.submit-btn {
  align-items: center;
  background: #0070f3;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  display: flex;
  font-size: 0.9375rem;
  font-weight: 500;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.25rem;
  padding: 0.6rem 1rem;
  transition: background 0.15s;
  width: 100%;
}

.submit-btn:hover:not(:disabled) { background: #005cc5; }
.submit-btn:disabled { opacity: 0.6; cursor: default; }

.spinner {
  animation: spin 0.7s linear infinite;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  flex-shrink: 0;
  height: 14px;
  width: 14px;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
