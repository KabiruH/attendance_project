import { db } from '@/lib/db/db'

async function main() {
  try {
    await db.$connect()
    console.log('Database connection successful')
    
    // Try to query the users table
    const userCount = await db.user.count()
    console.log(`Number of users in database: ${userCount}`)
    
  } catch (error) {
    console.error('Database connection failed:', error)
  } finally {
    await db.$disconnect()
  }
}

main()