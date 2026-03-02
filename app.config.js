import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  extra: {
    router: {},
    eas: {
      projectId: "c390cd20-4bef-4b81-b7fb-e5d2f9a58cec",
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || config.extra?.supabaseUrl,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || config.extra?.supabaseAnonKey,
  },
});