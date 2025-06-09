// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const adminUsers = [
    {
      name: 'John Doe',
      id_number: 'EMP001',
      employee_id: 1001,  // Use this for upsert
      email: 'john.doe@company.com',  // Required field
      role: 'Admin',
      phone_number: '+1234567890',
      gender: 'Male',
      is_active: true,
      created_by: 'System'
    },
    {
      name: 'Jane Smith',
      id_number: 'EMP002',
      employee_id: 1002,  // Use this for upsert
      email: 'jane.smith@company.com',  // Required field
      role: 'Admin',
      phone_number: '+1234567891',
      gender: 'Female',
      is_active: true,
      created_by: 'System'
    }
  ]

  console.log('Start seeding admin users...')
  
  for (const userData of adminUsers) {
    const user = await prisma.users.upsert({
      where: { id_number: userData.id_number }, // Use employee_id instead
      update: {},
      create: userData,
    })
    console.log(`Created/Updated user: ${user.name} (${user.id_number})`)
  }

  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })