import { defineConfig } from 'drizzle-kit';
import { requireDatabaseUrl } from './src/server/db/env-cli';

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: requireDatabaseUrl(),
  },
});
