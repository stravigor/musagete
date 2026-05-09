import { env } from '@strav/kernel'

export default {
  host: env('DB_HOST', '127.0.0.1'),
  port: env.int('DB_PORT', 5432),
  username: env('DB_USER', 'postgres'),
  password: env('DB_PASSWORD', ''),
  database: env('DB_DATABASE', 'musagete'),
  pool: env.int('DB_POOL_MAX', 10),
  idleTimeout: env.int('DB_IDLE_TIMEOUT', 20),
}
