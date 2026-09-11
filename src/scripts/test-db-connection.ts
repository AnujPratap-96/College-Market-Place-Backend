import { PrismaClient } from '@prisma/client';

async function testConnection() {
  console.log('Testing connection to DATABASE_URL:');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set in environment.');
    process.exit(1);
  }

  const masked = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('Target:', masked);

  const prisma = new PrismaClient();

  try {
    const start = Date.now();
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT 1 as connected;`;
    const elapsed = Date.now() - start;
    console.log('Successfully connected to database in', elapsed, 'ms!');
    console.log('Query result:', result);
    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('Connection failed:');
    console.error('Code:', error.code || 'N/A');
    console.error('Message:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
