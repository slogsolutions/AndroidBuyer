interface EnvConfig {
  GOOGLE_CLIENT_ID: string;
  MAPBOX_TOKEN: string;
}

export const env: EnvConfig = {
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  MAPBOX_TOKEN: import.meta.env.VITE_MAPBOX_TOKEN,
};