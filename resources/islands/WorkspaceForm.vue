<template>
  <form class="form" @submit.prevent="submit">
    <label>
      Workspace name
      <input
        v-model="name"
        type="text"
        required
        maxlength="80"
        placeholder="Acme Cloud"
        @input="onNameInput"
      />
    </label>
    <label>
      Slug
      <input
        v-model="slug"
        type="text"
        required
        maxlength="80"
        placeholder="acme-cloud"
        @input="slugTouched = true"
      />
      <small>Lowercase, dash-joined, URL-safe. Used in workspace URLs.</small>
    </label>
    <button type="submit" :disabled="submitting">
      {{ submitting ? 'Creating…' : 'Create workspace' }}
    </button>
    <p v-if="error" class="error">{{ error }}</p>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const name = ref('')
const slug = ref('')
let slugTouched = false
const submitting = ref(false)
const error = ref<string | null>(null)

function onNameInput() {
  if (!slugTouched) slug.value = slugify(name.value)
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function submit() {
  submitting.value = true
  error.value = null
  try {
    const res = await fetch('/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.value, slug: slug.value }),
      redirect: 'manual',
    })
    if (res.status === 302) {
      const dest = res.headers.get('location') ?? '/'
      window.location.assign(dest)
    } else if (res.status === 409) {
      error.value = 'That slug is taken. Pick another.'
    } else if (res.status === 400) {
      error.value = 'Name and slug are required.'
    } else {
      const body = await res.text()
      error.value = `Server error (${res.status}): ${body}`
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
  max-width: 480px;
  margin: 2rem auto;
  padding: 1.5rem;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  font-family: system-ui, sans-serif;
}
label {
  display: block;
  margin-bottom: 1rem;
}
input[type='text'] {
  display: block;
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.25rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font: inherit;
}
small {
  display: block;
  margin-top: 0.25rem;
  color: #666;
}
button {
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
</style>
