import { env } from '@strav/kernel'

export default {
  default: env('MAIL_DRIVER', 'log'),
  from: env('MAIL_FROM', 'noreply@localhost'),
  templatePrefix: env('MAIL_TEMPLATE_PREFIX', 'emails'),
  inlineCss: env.bool('MAIL_INLINE_CSS', true),
  tailwind: env.bool('MAIL_TAILWIND', false),

  smtp: {
    host: env('SMTP_HOST', '127.0.0.1'),
    port: env.int('SMTP_PORT', 587),
    secure: env.bool('SMTP_SECURE', false),
    auth: {
      user: env('SMTP_USER', ''),
      pass: env('SMTP_PASS', ''),
    },
  },
}
