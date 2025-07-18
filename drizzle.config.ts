
import type { Config } from 'drizzle-kit'

export default {
  dialect: 'sqlite',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/054f036bde3a24ecb2146c4802b083adfbf6bf66128e329b94fea609f5f9ac3d.sqlite'
  }
} satisfies Config
