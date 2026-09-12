import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const parsedSentryTraceRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE);
const sentryTraceRate = Number.isFinite(parsedSentryTraceRate)
  ? Math.max(0, Math.min(parsedSentryTraceRate, 1))
  : 0.1;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    tracesSampleRate: sentryTraceRate,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div style={{ padding: 24, color: '#ef4444', background: '#13131d', minHeight: '100vh' }}>
          页面出现异常，错误已自动记录。请刷新页面后重试。
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
