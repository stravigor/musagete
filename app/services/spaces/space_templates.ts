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
        body: 'Add your first runbook here.',
      },
      {
        slug: 'how-we-use-adrs',
        title: 'How we use ADRs',
        folderPath: '/ADRs',
        body: 'Add your first ADR here.',
      },
      {
        slug: 'on-call-handbook',
        title: 'On-call Handbook',
        folderPath: '/On-call',
        body: 'Add your on-call playbook here.',
      },
      {
        slug: 'api-reference-overview',
        title: 'API Reference',
        folderPath: '/API Reference',
        body: 'Add your API reference here.',
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
