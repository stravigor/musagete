<template>
  <div class="wizard">
    <ol class="steps" :data-current-step="step">
      <li :class="{ active: step === 1 }">1. Template</li>
      <li :class="{ active: step === 2 }">2. Identity</li>
      <li :class="{ active: step === 3 }">3. Access</li>
      <li :class="{ active: step === 4 }">4. Members</li>
    </ol>

    <!-- Step 1 — Template -->
    <section v-if="step === 1" class="step">
      <h2>Pick a template</h2>
      <ul class="templates">
        <li v-for="t in templates" :key="t.id">
          <label>
            <input
              type="radio"
              :value="t.id"
              v-model="form.template"
            />
            {{ t.label }}
          </label>
        </li>
      </ul>
      <button class="next" :disabled="!form.template" @click="step = 2">Next</button>
    </section>

    <!-- Step 2 — Identity -->
    <section v-else-if="step === 2" class="step">
      <h2>Name and slug</h2>
      <label>
        Name
        <input v-model="form.name" type="text" maxlength="80" required />
      </label>
      <label>
        Slug
        <input v-model="form.slug" type="text" maxlength="80" required />
        <small>Lowercase, dash-joined, URL-safe.</small>
      </label>
      <div class="actions">
        <button @click="step = 1">Back</button>
        <button
          class="next"
          :disabled="!form.name || !form.slug"
          @click="onIdentityNext"
        >Next</button>
      </div>
    </section>

    <!-- Step 3 — Access -->
    <section v-else-if="step === 3" class="step">
      <h2>Access</h2>
      <fieldset>
        <legend>Visibility</legend>
        <label>
          <input type="radio" value="protected" v-model="form.visibility" />
          Protected — every workspace member can see this space
        </label>
        <label>
          <input type="radio" value="private" v-model="form.visibility" />
          Private — only invited members can see this space
        </label>
      </fieldset>
      <fieldset>
        <legend>Defaults</legend>
        <label>
          <input type="checkbox" v-model="form.requireReview" />
          Require PR review before publish
        </label>
        <label>
          <input type="checkbox" v-model="form.allowComments" />
          Allow comments
        </label>
        <label>
          <input type="checkbox" v-model="form.aiIndex" />
          Index docs for AI search
        </label>
      </fieldset>
      <div class="actions">
        <button @click="step = 2">Back</button>
        <button class="next" @click="step = 4">Next</button>
      </div>
    </section>

    <!-- Step 4 — Members (placeholder for v2 invitations) -->
    <section v-else-if="step === 4" class="step">
      <h2>Members</h2>
      <p>
        You'll be the space's first member as the workspace owner. Invitations
        for additional members ship in a future release; for now, anyone with
        the matching role in this workspace can use the space.
      </p>
      <div class="actions">
        <button @click="step = 3">Back</button>
        <button class="next" :disabled="submitting" @click="submit">
          {{ submitting ? 'Creating…' : 'Create space' }}
        </button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

type TemplateOption = {
  id: string
  label: string
  defaults: { requireReview: boolean; allowComments: boolean; aiIndex: boolean }
}

const props = defineProps<{
  workspaceSlug: string
  templates: TemplateOption[]
}>()

const step = ref(1)
const submitting = ref(false)
const error = ref<string | null>(null)

const form = ref({
  template: '',
  name: '',
  slug: '',
  visibility: 'protected' as 'protected' | 'private',
  requireReview: true,
  allowComments: true,
  aiIndex: true,
})

// Snap defaults to the chosen template whenever the user changes step 1.
watch(
  () => form.value.template,
  (id) => {
    const tmpl = props.templates.find((t) => t.id === id)
    if (!tmpl) return
    form.value.requireReview = tmpl.defaults.requireReview
    form.value.allowComments = tmpl.defaults.allowComments
    form.value.aiIndex = tmpl.defaults.aiIndex
  },
)

// Auto-derive slug from name if the user hasn't typed a slug yet.
let slugTouched = false
watch(
  () => form.value.slug,
  () => {
    if (form.value.slug.length > 0) slugTouched = true
  },
)
function onIdentityNext() {
  if (!slugTouched && form.value.name.length > 0) {
    form.value.slug = slugify(form.value.name)
  }
  step.value = 3
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
    // Default `redirect: 'follow'` so fetch traverses the controller's 302
    // to the space read view; `res.url` is the final URL we navigate to.
    // (`redirect: 'manual'` returns an opaqueredirect with status 0 and
    // no headers — indistinguishable from a server error.)
    const res = await fetch(`/workspaces/${props.workspaceSlug}/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: form.value.template,
        name: form.value.name,
        slug: form.value.slug,
        visibility: form.value.visibility,
        requireReview: form.value.requireReview,
        allowComments: form.value.allowComments,
        aiIndex: form.value.aiIndex,
      }),
    })

    if (res.ok) {
      window.location.assign(res.url)
      return
    }

    if (res.status === 409) {
      error.value = 'That slug is taken in this workspace. Pick another.'
      step.value = 2
    } else if (res.status === 422) {
      error.value = 'Unknown template. Pick one from the list.'
      step.value = 1
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
.wizard {
  max-width: 640px;
  margin: 2rem auto;
  padding: 1.5rem;
  border: 1px solid var(--bg-feature, #e5e5e5);
  border-radius: 8px;
  font-family: system-ui, sans-serif;
}
.steps {
  display: flex;
  gap: 1rem;
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem 0;
  font-size: 0.9rem;
  color: #888;
}
.steps li.active {
  color: #111;
  font-weight: 600;
}
.step h2 {
  margin-top: 0;
  font-size: 1.25rem;
}
.templates {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
  display: grid;
  gap: 0.5rem;
}
.templates label {
  display: block;
  padding: 0.75rem;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  cursor: pointer;
}
.templates label:has(input:checked) {
  border-color: #111;
  background: #f5f5f5;
}
label {
  display: block;
  margin: 0.5rem 0;
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
fieldset {
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
}
.actions {
  display: flex;
  justify-content: space-between;
  margin-top: 1.25rem;
}
button {
  padding: 0.5rem 1rem;
  border: 1px solid #111;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}
button.next {
  background: #111;
  color: white;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.error {
  margin-top: 1rem;
  color: #b00020;
  font-size: 0.9rem;
}
</style>
