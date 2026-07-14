export const environment = {
  production: true,
  apiUrl: 'https://api.3mbevents.com/api',
  /** Backend/nginx must proxy this path to Nominatim (browser CORS blocks direct OSM). */
  nominatimUrl: 'https://api.3mbevents.com/api/geocode',
  useMocks: false,
  /** Public Google OAuth Web client ID (safe in the browser). */
  googleClientId: '399163261650-pu4sckhdukim2hf61bv2qqa7md55eie8.apps.googleusercontent.com'
};
