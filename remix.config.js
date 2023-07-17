/**
 * @type {import('@remix-run/dev/config').AppConfig}
 */

module.exports = {
  future: {
    v2_headers: true,
    v2_errorBoundary: true,
    v2_normalizeFormMethod: true,
    v2_meta: true,
    v2_routeConvention: true,
    v2_dev: true,
  },
  appDirectory: 'app',
  assetsBuildDirectory: 'public/static',
  cacheDirectory: 'node_modules/.cache',
  devServerPort: 8002,
  ignoredRouteFiles: [
    '**/*.test.{js,jsx,ts,tsx}',
    '**/__components/*.{js,jsx,ts,tsx}',
  ],
  publicPath: '/static/',
  server: process.env.NODE_ENV === 'production' && 'server/remix.ts',
  serverBuildPath: 'server/build/index.js',
  serverMainFields: ['module', 'main'],
  serverModuleFormat: 'cjs',
  serverPlatform: 'node',
  serverMinify: false,
  serverDependenciesToBundle: [/.*/],
}
