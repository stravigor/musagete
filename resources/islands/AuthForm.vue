<template>
  <div class="form">
    <form v-if="state === 'form'" @submit.prevent="submit">
      <label>
        Email
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          placeholder="you@example.com"
        />
      </label>
      <button type="submit" :disabled="submitting">
        {{ submitting ? 'Sending…' : 'Email me a link' }}
      </button>
      <p v-if="error" class="error">{{ error }}</p>
      <details class="oauth">
        <summary>or sign in with…</summary>
        <a class="oauth-btn" href="/auth/oauth/google/start">Google</a>
        <a class="oauth-btn" href="/auth/oauth/github/start">GitHub</a>
      </details>
    </form>

    <div v-else-if="state === 'sent'" class="sent">
      <h2>Check your email</h2>
      <p>
        We sent a sign-in link to <strong>{{ email }}</strong>. The link is
        valid for 15 minutes.
      </p>
      <p class="dev-hint">
        <strong>Dev tip:</strong> with <code>MAIL_DRIVER=log</code>, the magic
        link prints to the dev-server console. Look for an entry tagged
        <code>mail.send</code> and click the URL.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const state = ref<'form' | 'sent'>('form')
const email = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

async function submit() {
  submitting.value = true
  error.value = null
  try {
    const res = await fetch('/auth/magic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value }),
    })
    if (res.status === 202) {
      state.value = 'sent'
    } else if (res.status === 400) {
      error.value = 'That doesn\'t look like a valid email.'
    } else if (res.status === 429) {
      const body = (await res.json()) as { retry_after?: number }
      error.value = `Too many attempts. Try again in ${body.retry_after ?? 600}s.`
    } else {
      error.value = `Server error (${res.status}). Try again.`
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}
</script>

<style module>
.form {
  max-width: 420px;
  margin: 2rem auto;
  padding: 1.5rem;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  font-family: system-ui, sans-serif;
}
form label {
  display: block;
  margin-bottom: 1rem;
}
input[type='email'] {
  display: block;
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.25rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font: inherit;
}
button {
  width: 100%;
  padding: 0.6rem 1rem;
  border: 1px solid #111;
  background: #111;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.error {
  margin-top: 0.75rem;
  color: #b00020;
  font-size: 0.9rem;
}
.oauth {
  margin-top: 1.25rem;
  font-size: 0.95rem;
}
.oauth summary {
  cursor: pointer;
  color: #444;
}
.oauth-btn {
  display: inline-block;
  margin: 0.5rem 0.5rem 0 0;
  padding: 0.4rem 0.8rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  text-decoration: none;
  color: #111;
}
.sent h2 { margin-top: 0; }
.dev-hint {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fff8dc;
  border-left: 3px solid #d4a017;
  font-size: 0.9rem;
}
</style>
