// @ts-check
import { withSentryConfig } from '@sentry/nextjs';

const sentryConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_AUTH_TOKEN);
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Preserve jsdom's filesystem assets; HTML sanitization remains enabled.
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom'],
  experimental: {
    proxyTimeout: 90_000,
    webpackMemoryOptimizations: true,
  },
  async headers() {
    return [
      { source: '/:path*', headers: [{ key: 'Document-Policy', value: 'js-profiling' }] },
      { source: '/caleonis-studio/:path*', headers: [
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'" },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'same-origin' },
      ] },
    ];
  },
  reactStrictMode: false,
  transpilePackages: ['crypto-hash'],
  // Source maps are useful only when an upload destination is configured.
  // Do not exhaust the pilot builder generating maps for an absent Sentry account.
  productionBrowserSourceMaps: uploadSourceMaps,
  webpack: (config, { dev, isServer }) => {
    if (!dev) config.devtool = uploadSourceMaps ? (isServer ? 'source-map' : 'hidden-source-map') : false;
    return config;
  },
  async redirects() {
    return [{ source: '/api/uploads/:path*', destination: process.env.STORAGE_PROVIDER === 'local' ? '/uploads/:path*' : '/404', permanent: true }];
  },
  async rewrites() {
    return [{ source: '/uploads/:path*', destination: process.env.STORAGE_PROVIDER === 'local' ? '/api/uploads/:path*' : '/404' }];
  },
};

export default sentryConfigured ? withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !uploadSourceMaps,
    assets: ['.next/static/**/*.js', '.next/static/**/*.js.map', '.next/server/**/*.js', '.next/server/**/*.js.map'],
    ignore: ['**/node_modules/**', '**/*hot-update*', '**/_buildManifest.js', '**/_ssgManifest.js', '**/*.test.js', '**/*.spec.js'],
    deleteSourcemapsAfterUpload: true,
  },
  release: {
    create: uploadSourceMaps,
    finalize: uploadSourceMaps,
    name: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || undefined,
  },
  widenClientFileUpload: true,
  telemetry: false,
  silent: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',
  errorHandler: (error) => {
    console.warn('Sentry build error occurred:', error.message);
  },
}) : nextConfig;
