/**
 * Infrastructure / deployment configuration.
 *
 * None of this affects ticketing behaviour; it wires up the database,
 * cache and the payment provider client. Pulled from the environment.
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  keyPrefix: string;
}

export interface RuntimeConfig {
  database: DatabaseConfig;
  redis: RedisConfig;
  stripeSecretKey: string;
  identityWebhookSecret: string;
  paymentWebhookSecret: string;
}

export function loadRuntimeConfig(): RuntimeConfig {
  return {
    database: {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'gatekeep',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'gatekeep',
    },
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      keyPrefix: 'gatekeep:',
    },
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? 'sk_test_unset',
    identityWebhookSecret: process.env.IDENTITY_WEBHOOK_SECRET ?? '',
    paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? '',
  };
}
