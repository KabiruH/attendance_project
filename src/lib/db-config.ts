//db-config.ts
export const dbConfig = {
    server: process.env.DB_SERVER || 'MARSHMELLO',
    database: process.env.DB_NAME || 'ATTENDANCEDB',
    options: {
      trustServerCertificate: true,
      trustedConnection: true, 
      enableArithAbort: true,
    },
  };