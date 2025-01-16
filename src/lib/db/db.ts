// lib/db.ts
import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

if (!global.prisma) {
  global.prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  })
}

export const db = global.prisma