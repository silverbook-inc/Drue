import 'dotenv/config';

const required = ['SUPABASE_URL', 'SUPABASE_JWT_ISSUER'] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT || '3001'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL as string,
  supabaseJwtIssuer: process.env.SUPABASE_JWT_ISSUER as string,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET
};
