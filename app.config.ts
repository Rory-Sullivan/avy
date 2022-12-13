import {ExpoConfig, ConfigContext} from '@expo/config';

export default ({config}: ConfigContext): Partial<ExpoConfig> => {
  // `config` is the object loaded from app.json. Here, we fill in secrets that
  // we keep in the environment and out of code. For cloud builds, the secrets
  // are stored in Expo and supplied via process.env. For local builds, the
  // secrets can be stored in a .env file and loaded via direnv.
  config.ios!.config!.googleMapsApiKey = process.env.IOS_GOOGLE_MAPS_API_KEY;
  config.android!.config!.googleMaps!.apiKey = process.env.ANDROID_GOOGLE_MAPS_API_KEY;
  config.hooks!.postPublish![0]!.config!.authToken = process.env.SENTRY_API_TOKEN;
  config.extra!.sentry_dsn = process.env.SENTRY_DSN;

  return config;
};
