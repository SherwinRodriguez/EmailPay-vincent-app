import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import { LIT_RPC } from '@lit-protocol/constants';

// Ref: https://github.com/t3-oss/t3-env/pull/145
const booleanStrings = ['true', 'false', true, false, '1', '0', 'yes', 'no', 'y', 'n', 'on', 'off'];
const BooleanOrBooleanStringSchema = z
  .any()
  .refine((val) => booleanStrings.includes(val), { message: 'must be boolean' })
  .transform((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const normalized = val.toLowerCase().trim();
      if (['true', 'yes', 'y', '1', 'on'].includes(normalized)) return true;
      if (['false', 'no', 'n', '0', 'off'].includes(normalized)) return false;
      throw new Error(`Invalid boolean string: "${val}"`);
    }
    throw new Error(`Expected boolean or boolean string, got: ${typeof val}`);
  });

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: {
    ALCHEMY_API_KEY: z.string().optional(),
    ALCHEMY_POLICY_ID: z.string().optional(),
    ALLOWED_AUDIENCE: z.string().url(),
    BASE_RPC_URL: z.string().url(),
    CHRONICLE_YELLOWSTONE_RPC: z.string().url().default(LIT_RPC.CHRONICLE_YELLOWSTONE),
    CORS_ALLOWED_DOMAIN: z.string().url(),
    DEFAULT_TX_CONFIRMATIONS: z.coerce.number().default(6),
    IS_DEVELOPMENT: BooleanOrBooleanStringSchema,
    MONGODB_URI: z.string().url(),
    PORT: z.coerce.number(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    VINCENT_APP_ID: z.coerce.number(),
    VINCENT_DELEGATEE_PRIVATE_KEY: z.string(),
    
    // EmailPay Configuration (optional)
    SEPOLIA_RPC: z.string().url().optional(),
    CHAIN_ID: z.coerce.number().default(11155111),
    PYUSD_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    LIT_NETWORK: z.enum(['datil-dev', 'datil', 'habanero', 'manzano']).default('datil'),
    GMAIL_CLIENT_ID: z.string().optional(),
    GMAIL_CLIENT_SECRET: z.string().optional(),
    GMAIL_REFRESH_TOKEN: z.string().optional(),
    GMAIL_USER: z.string().email().optional(),
    GMAIL_POLL_QUERY: z.string().default('in:inbox newer_than:1d'),
    MAX_TX_AMOUNT: z.coerce.number().default(100),
    DAILY_TX_CAP: z.coerce.number().default(500),
    TX_EXPIRY_MINUTES: z.coerce.number().default(30),
    HOT_WALLET_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
    
    // Stytch OTP Configuration (for official Lit Protocol OTP flow)
    STYTCH_PROJECT_ID: z.string().optional(),
    STYTCH_SECRET: z.string().optional(),
    LIT_RELAY_API_KEY: z.string().optional(),
  },
});
