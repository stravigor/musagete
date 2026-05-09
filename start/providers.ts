import { HttpProvider, SessionProvider } from "@strav/http"
import { ConfigProvider, EncryptionProvider, ServiceProvider } from "@strav/kernel"
import { DatabaseProvider } from "@strav/database"
import { MailProvider } from "@strav/signal"
import { SocialProvider } from "@strav/social"
import { ViewProvider, PagesProvider } from '@strav/view'

export const providers: ServiceProvider[] = [
  new ConfigProvider(),
  new HttpProvider(),
  new DatabaseProvider(),
  new EncryptionProvider(),
  // Strav's SessionProvider — required by @strav/social's redirect()/user()
  // for CSRF state binding. Used only on the OAuth routes via the session()
  // middleware; the project's own auth state lives in our `session` table
  // (see app/services/auth/session_service.ts) under cookie `musagete_session`.
  new SessionProvider(),
  new MailProvider(),
  new SocialProvider(),
  new ViewProvider(),
  new PagesProvider(),
]