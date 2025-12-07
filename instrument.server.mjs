import * as Sentry from "@sentry/tanstackstart-react";

Sentry.init({
  // NOTE: We use `process.env.VITE_SENTRY_DSN` (instead of import.meta.env) because Vite hasn't been loaded yet
  dsn: process.env.VITE_SENTRY_DSN,
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
});
