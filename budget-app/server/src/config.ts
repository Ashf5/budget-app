import 'dotenv/config';

export const config = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || '',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  plaidClientId: process.env.PLAID_CLIENT_ID || '',
  plaidSecret: process.env.PLAID_SECRET || '',
  plaidEnv: process.env.PLAID_ENV || 'sandbox',
};

const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
