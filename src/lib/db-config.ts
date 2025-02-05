//db-config.ts
export const dbConfig = {
    server: process.env.DB_SERVER ?? 'MARSHMELLO',
    database: process.env.DB_NAME ?? 'attendanceDB',
    options: {
      trustServerCertificate: true,
      trustedConnection: true, 
      enableArithAbort: true,
    },
  };