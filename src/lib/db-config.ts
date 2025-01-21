//db-config.ts
export const dbConfig = {
    server: process.env.DB_SERVER || 'NICCO99',
    database: process.env.DB_NAME || 'attendance',
    options: {
      trustServerCertificate: true,
      trustedConnection: true, 
      enableArithAbort: true,
    },
  };