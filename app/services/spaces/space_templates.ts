/**
 * Space template registry — slice 002 § DoD names six v1 templates:
 * Blank, Engineering, Product, People & Process, Security & Compliance,
 * Public API Docs. Each template defines:
 *   - per-space defaults (require_review / allow_comments / ai_index)
 *   - a folder structure with at least one seeded Doc per folder
 *   - placeholder bodies (per Build-T0 resolution: "Add your first runbook
 *     here." etc. — substantive starter content is deferred)
 *
 * The registry is keyed by the template id (`engineering`, `product`, …)
 * the wizard submits in its `template` field. `createSpace` looks the
 * template up and applies its folders + defaults atomically.
 *
 * Templates other than `engineering` are stub-shaped for v1: they exist
 * with the right key + defaults but no folders. They'll be populated in
 * a follow-up Micro-Turn before slice 002 ships (slice DoD).
 */

export type SeedDoc = {
  slug: string
  title: string
  folderPath: string
  body: string
}

export type SpaceTemplate = {
  id: string
  defaults: {
    requireReview: boolean
    allowComments: boolean
    aiIndex: boolean
  }
  docs: SeedDoc[]
}

export const SPACE_TEMPLATES: Record<string, SpaceTemplate> = {
  blank: {
    id: 'blank',
    defaults: { requireReview: false, allowComments: true, aiIndex: true },
    // Blank ships empty by design — the user starts from a clean slate.
    docs: [],
  },

  engineering: {
    id: 'engineering',
    defaults: { requireReview: true, allowComments: true, aiIndex: true },
    docs: [
      {
        slug: 'welcome-runbook',
        title: 'Welcome to Runbooks',
        folderPath: '/Runbooks',
        body: `# Welcome to Runbooks

This space is your team's runbook home. Each entry should describe a single,
specific operational scenario — what triggers it, who owns it, and the exact
sequence of steps to bring the system back to a known-good state.

> :memo: **Runbooks are written for the on-call engineer at 3am.** Assume tired,
> assume context-free, assume scared. Short steps, code-block-quoted commands,
> inline links to dashboards. {.callout}

## What belongs here

- **Service-specific runbooks.** One runbook per service per failure mode.
- **Pipeline triage steps.** What to do when a deploy stages but doesn't promote.
- **Database recovery.** Backups, point-in-time restore, replica failover.

## A starter command

\`\`\`bash
# Roll back the most recent release
acme rollback --release latest --reason "p99 spike"
\`\`\`

Replace this doc with your first runbook when you're ready.
`,
      },
      {
        slug: 'how-we-use-adrs',
        title: 'How we use ADRs',
        folderPath: '/ADRs',
        body: `# How we use ADRs

An **Architectural Decision Record** captures one decision worth more than a
day to reverse. Every ADR has a Status, a Context, a Decision, and the
Consequences (what we accept by choosing it).

## Format

\`\`\`markdown
# ADR-NNNN — short imperative title

Status: proposed | accepted | superseded
Date: YYYY-MM-DD
Decided by: <name>

## Context
## Decision
## Tradeoffs
## Consequences
\`\`\`

ADRs are append-only. When a decision is reversed, supersede it with a new
ADR rather than editing the old one — the historical record is the value.
`,
      },
      {
        slug: 'on-call-handbook',
        title: 'On-call Handbook',
        folderPath: '/On-call',
        body: `# On-call Handbook

If you've been paged, start here.

## First five minutes

1. **Acknowledge the page** — silence the alert in the on-call tool.
2. **Open \`#deploys\`** — the orchestrator posts a threaded message per
   release; transient failures often annotate themselves before a human sees
   them.
3. **Don't \`git revert\`** — use \`acme rollback\` so the migration ratchet
   stays consistent.

## Escalation paths

Replace this with your team's actual escalation matrix.
`,
      },
      {
        slug: 'api-reference-overview',
        title: 'API Reference',
        folderPath: '/API Reference',
        body: `# API Reference

This space is where your API lives. Two ways to populate it:

- **Hand-written.** One doc per endpoint, with request/response shapes,
  auth requirements, and rate limits.
- **OpenAPI ingestion.** Drop your \`openapi.yaml\` and the docs materialize
  from the spec (Public API Docs template).

## Conventions

- Endpoints documented as \`POST /v1/<resource>\` headers.
- Code samples in \`shell\` (curl) and \`typescript\` (SDK).
- Error envelopes documented inline with each endpoint.
`,
      },
    ],
  },

  product: {
    id: 'product',
    defaults: { requireReview: false, allowComments: true, aiIndex: true },
    docs: [
      {
        slug: 'roadmap-q-overview',
        title: 'Roadmap',
        folderPath: '/Roadmap',
        body: 'Add the quarter-by-quarter roadmap here.',
      },
      {
        slug: 'spec-template',
        title: 'Spec template',
        folderPath: '/Specs',
        body: 'Add your first product spec here.',
      },
      {
        slug: 'changelog-readme',
        title: 'Changelog',
        folderPath: '/Changelog',
        body: 'Track shipped changes here.',
      },
    ],
  },

  'people-and-process': {
    id: 'people-and-process',
    defaults: { requireReview: false, allowComments: true, aiIndex: true },
    docs: [
      {
        slug: 'handbook-readme',
        title: 'Company handbook',
        folderPath: '/Handbook',
        body: 'Add your handbook entries here.',
      },
      {
        slug: 'onboarding-readme',
        title: 'New-hire onboarding',
        folderPath: '/Onboarding',
        body: 'Add your onboarding checklist here.',
      },
      {
        slug: 'retro-template',
        title: 'Retro template',
        folderPath: '/Retros',
        body: 'Add your first retro here.',
      },
    ],
  },

  'security-and-compliance': {
    id: 'security-and-compliance',
    // PR-review on by default per slice 002 DoD ("Security & Compliance:
    // SOC2/threat models, PR-review on by default").
    defaults: { requireReview: true, allowComments: true, aiIndex: true },
    docs: [
      {
        slug: 'soc2-readme',
        title: 'SOC 2 — control catalog',
        folderPath: '/SOC2',
        body: 'Add your SOC 2 control mappings here.',
      },
      {
        slug: 'threat-model-template',
        title: 'Threat model template',
        folderPath: '/Threat models',
        body: 'Add your first threat model here.',
      },
    ],
  },

  'public-api-docs': {
    id: 'public-api-docs',
    defaults: { requireReview: true, allowComments: true, aiIndex: true },
    docs: [
      {
        slug: 'openapi-ingestion',
        title: 'OpenAPI ingestion',
        folderPath: '/OpenAPI',
        body: 'Drop your OpenAPI spec here; the API reference materializes from it.',
      },
      {
        slug: 'code-samples-readme',
        title: 'Code samples',
        folderPath: '/Code samples',
        body: 'Add your first runnable code sample here.',
      },
      {
        slug: 'versioning-policy',
        title: 'Versioning policy',
        folderPath: '/Versioning',
        body: 'Document your backwards-compat and deprecation policy here.',
      },
    ],
  },
}

export function getTemplate(id: string): SpaceTemplate | null {
  return SPACE_TEMPLATES[id] ?? null
}
