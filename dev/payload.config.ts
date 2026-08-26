import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { payloadSimpleSocialLogin } from 'payload-simple-social-login'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: 'users',
  },
  collections: [
    {
      slug: 'users',
      auth: true,
      fields: [],
    },
    {
      slug: 'posts',
      fields: [],
    },
    {
      slug: 'media',
      fields: [],
      upload: {
        staticDir: path.resolve(dirname, 'media'),
      },
    },
  ],
  db: sqliteAdapter({
    client: {
      url:
        process.env.NODE_ENV === 'test'
          ? 'file::memory:?cache=shared'
          : process.env.DATABASE_URL || `file:${path.resolve(dirname, 'payload.db')}`,
    },
  }),
  editor: lexicalEditor(),
  email: testEmailAdapter,
  onInit: async (payload) => {
    await seed(payload)
  },
  plugins: [
    payloadSimpleSocialLogin({
      providers: {
        google: {
          clientId: process.env.SOCIAL_LOGIN_GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.SOCIAL_LOGIN_GOOGLE_CLIENT_SECRET || '',
        },
        microsoft: {
          clientId: process.env.SOCIAL_LOGIN_MICROSOFT_CLIENT_ID || '',
          clientSecret: process.env.SOCIAL_LOGIN_MICROSOFT_CLIENT_SECRET || '',
        },
      },
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
