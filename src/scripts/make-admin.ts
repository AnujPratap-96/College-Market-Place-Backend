import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { Role } from '@prisma/client';

async function makeAdmin() {
  const email = process.argv[2]?.trim();

  if (!email) {
    logger.error('❌ Error: Please provide an email address.');
    logger.info('Usage: npm run make-admin <email>');
    logger.info('Example: npm run make-admin student@college.edu');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      logger.error(`❌ Error: No user found with email: "${email}"`);
      process.exit(1);
    }

    if (user.role === Role.ADMIN) {
      logger.info(`ℹ️ User "${user.name}" (${user.email}) is ALREADY an ADMIN.`);
      process.exit(0);
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { role: Role.ADMIN },
    });

    logger.info(`\n🎉 Success! User promoted to ADMIN:`);
    logger.info(`   Name:    ${updated.name}`);
    logger.info(`   Email:   ${updated.email}`);
    logger.info(`   College: ${updated.college}`);
    logger.info(`   Role:    ${updated.role}`);
    logger.info(`\n⚠️ Note: The user should log out and log back in so their JWT token and UI reflect the ADMIN role.\n`);
  } catch (error) {
    logger.error('❌ Error promoting user to admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
