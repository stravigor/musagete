/**
 * Slice 003 — Reader (editorial layout) demo flow.
 *
 * The smoke-check from the slice's DoD, automated end-to-end:
 *
 *   1. Sign in via the magic-link flow                    (slice 001 surface)
 *   2. Create the "acme" workspace                        (slice 002 surface)
 *   3. Walk the wizard to create an "engineering" space   (slice 002 surface)
 *   4. Open the seeded "Welcome to Runbooks" doc          (slice 003 surface)
 *   5. Assert editorial typography is in effect           (slice 003 acceptance)
 *
 * Behavioral checks live here (URL transitions, redirect chains, computed
 * styles); visual fidelity (drop-cap weight, dark-mode swap, marginalia
 * placement) is still a human review per the AGON DoD's visual/behavioral
 * split. See the visual checklist recorded in the slice's Integrate-T1 entry.
 *
 * Mapping to the slice's BDD scenarios (003-reader-editorial-layout.md):
 *   - Scenario 1 (signed-in user opens the doc, sees editorial typography) →
 *     "renders the seeded engineering doc with editorial typography" test.
 *
 * Run: `bun test ./tests/spaces/slice-003-demo.flow.ts`
 *   (the explicit `./` is required — bun:test's discovery pattern only
 *    matches `*.test.ts` / `*.spec.ts`, so a `.flow.ts` file passed by name
 *    needs the path-form filter.)
 */
import { describe, test } from 'bun:test'
import { MusageteDemoFlow } from '../utils/musagete_demo_flow'

const flow = await MusageteDemoFlow.boot({ fresh: true })

describe('Slice 003 — reader demo flow', () => {
  // 60s — real browser + real server + magic-link round-trip overshoots
  // bun:test's 5s default. The cap surfaces hangs without losing real signal.
  test('signs in, walks the wizard, and the seeded doc renders with editorial typography', async () => {
    await flow.signIn('demo@example.com')

    // Workspace creation. After magic-link redeem, `/` redirects to
    // `/workspaces/new` for users with no last_workspace_id.
    await flow.goto('/workspaces/new')
    await flow.fill('input[placeholder="Acme Cloud"]', 'Acme Cloud')
    // Slug auto-derives via WorkspaceForm's slugify(); we don't fill it.
    await flow.click('button[type="submit"]')
    await flow.tc.waitForUrl(/\/workspaces\/acme-cloud$/, { timeout: 15_000 })

    // Wizard. Step 1 (template) → Step 2 (identity) → Step 3 (defaults) →
    // Step 4 (members) → submit.
    await flow.goto('/workspaces/acme-cloud/spaces/new')
    await flow.click('input[type="radio"][value="engineering"]')
    await flow.click('button.next:has-text("Next")')
    await flow.fill('label:has-text("Name") input', 'Platform')
    await flow.fill('label:has-text("Slug") input', 'platform')
    await flow.click('button.next:has-text("Next")')
    await flow.click('button.next:has-text("Next")')
    await flow.click('button.next:has-text("Create space")')
    await flow.tc.waitForUrl(/\/workspaces\/acme-cloud\/spaces\/platform$/)

    // Reader. The engineering template seeds a "Welcome to Runbooks" doc.
    await flow.click('a:has-text("Welcome to Runbooks")')
    await flow.tc.waitForUrl(/\/d\/welcome-runbook$/)

    // Editorial typography — Newsreader serif on the h1 and a drop-cap on
    // `.lede::first-letter`. Both are bound to the slice's BDD scenario 1.
    await flow.expectVisible('article.read h1', /Welcome to Runbooks/)
    await flow.expectComputedStyle('article.read h1', 'font-family', /Newsreader/)
    await flow.expectComputedStyle('article.read .lede::first-letter', 'font-size', { gt: 40 })
  }, 60_000)
})
