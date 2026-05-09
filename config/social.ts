import { env } from '@strav/kernel'

export default {
  userKey: 'id',
  providers: {
    google: {
      clientId: env('GOOGLE_CLIENT_ID', ''),
      clientSecret: env('GOOGLE_CLIENT_SECRET', ''),
      redirectUrl: env('GOOGLE_REDIRECT_URL', 'http://localhost:3000/auth/google/callback'),
    },
    github: {
      clientId: env('GITHUB_CLIENT_ID', ''),
      clientSecret: env('GITHUB_CLIENT_SECRET', ''),
      redirectUrl: env('GITHUB_REDIRECT_URL', 'http://localhost:3000/auth/github/callback'),
    },
  },
}
