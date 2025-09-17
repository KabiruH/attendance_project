// lib/db.ts
import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    // Optional: Configure connection pool
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

export const db = globalThis.prisma ?? createPrismaClient()

// Prevent multiple instances during development hot reload
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await db.$disconnect()
})