export const environment = {
  production: false,
  apiUrl: '/api',
  /** Same-origin Nominatim proxy (see proxy.conf.json) — direct OSM URL is blocked by CORS. */
  nominatimUrl: '/nominatim',
  useMocks: false,
  /** Public Google OAuth Web client ID (safe in the browser). */
  googleClientId: '399163261650-pu4sckhdukim2hf61bv2qqa7md55eie8.apps.googleusercontent.com'
};
