// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const adminUsers = [
    {
      name: 'Kelvin',
      id_number: 'ADM001',
      role: 'admin',
      phone_number: '+1234567890',
      gender: 'Male',
      department: 'executive',
      is_active: true,
      created_by: 'System'
    },
    {
      name: 'Jane Smith',
      id_number: 'EMP002', 
      role: 'admin',
      phone_number: '+1234567891',
      gender: 'Female',
      department: 'executive',
      is_active: true,
      created_by: 'System'
    }
  ]

  console.log('Start seeding admin users...')
  
  for (const userData of adminUsers) {
    const user = await prisma.users.upsert({
      where: { id_number: userData.id_number }, 
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