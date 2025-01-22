# Employee Attendance Management System

A modern web application built with Next.js 14, TypeScript, Prisma, and SQL Server for managing employee attendance with geo-fencing capabilities.

## Features

### Authentication
- Secure login and registration system
- Role-based access control (Admin and Employee)
- Password change functionality
- Geo-fencing for location-based access

### Employee Features
- Check-in and check-out functionality
- View personal attendance history
- Monthly attendance overview
- Weekly hours visualization
- Personal profile management

### Admin Features
- View all employee attendance records
- Real-time attendance monitoring
- Employee attendance reports
- Export attendance data to CSV
- Admin dashboard with statistics

### Dashboard Analytics
- Present/Late/Absent statistics
- Monthly attendance charts
- Weekly hours tracking
- Attendance rate calculations

## Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: SQL Server
- **ORM**: Prisma
- **Authentication**: JWT (jose)
- **Charts**: Recharts
- **Styling**: Tailwind CSS

## Prerequisites

- Node.js 18.x or higher
- SQL Server
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone KabiruH/attendance_project
cd employee-attendance-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```env
DATABASE_URL="sqlserver://server:port;database=ATTENDANCEDB;user=username;password=password;trustServerCertificate=true"
JWT_SECRET="your-jwt-secret"
```

4. Run Prisma migrations:
```bash
npx prisma migrate dev
```

5. Start the development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── attendance/
│   │   ├── reports/
│   │   └── profile/
│   └── api/
│       ├── auth/
│       └── attendance/
├── components/
│   ├── ui/
│   ├── dashboard/
│   └── reports/
├── lib/
│   ├── db/
│   ├── auth.ts
│   └── geofence.ts
└── types/
```

## Database Schema

```prisma
model Employees {
  id         Int          @id @default(autoincrement())
  name       String?      @db.VarChar(100)
  email      String       @unique @db.VarChar(100)
  role       String?      @default("Employee") @db.VarChar(10)
  password   String       @db.VarChar(255)
  created_at DateTime?    @default(now())
  Attendance Attendance[]
}

model Attendance {
  id             Int       @id @default(autoincrement())
  employee_id    Int
  date           DateTime  @db.Date
  check_in_time  DateTime?
  check_out_time DateTime?
  status         String    @default("Absent") @db.VarChar(10)
  Employees      Employees @relation(fields: [employee_id], references: [id])
}
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/check` - Check authentication status
- `POST /api/auth/change-password` - Change user password

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance` - Create attendance record
- `GET /api/attendance/status` - Get attendance status

## Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Geo-fencing for location-based access
- Role-based access control
- Protected API routes
- Input validation and sanitization

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request

## License

[Your License Choice]

## Support

For support, please contact [your contact information].

## Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for UI components
- [Recharts](https://recharts.org/) for charts
- [Prisma](https://www.prisma.io/) for database ORM
- [Next.js](https://nextjs.org/) for the framework

Would you like me to expand on any particular section or add more details?