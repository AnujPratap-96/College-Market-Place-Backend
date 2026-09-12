import prisma from '../lib/prisma';
import { Role } from '@prisma/client';

async function makeAdmin() {
  const email = process.argv[2]?.trim();

  if (!email) {
    console.error('❌ Error: Please provide an email address.');
    console.log('Usage: npm run make-admin <email>');
    console.log('Example: npm run make-admin student@college.edu');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ Error: No user found with email: "${email}"`);
      process.exit(1);
    }

    if (user.role === Role.ADMIN) {
      console.log(`ℹ️ User "${user.name}" (${user.email}) is ALREADY an ADMIN.`);
      process.exit(0);
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { role: Role.ADMIN },
    });

    console.log(`\n🎉 Success! User promoted to ADMIN:`);
    console.log(`   Name:    ${updated.name}`);
    console.log(`   Email:   ${updated.email}`);
    console.log(`   College: ${updated.college}`);
    console.log(`   Role:    ${updated.role}`);
    console.log(`\n⚠️ Note: The user should log out and log back in so their JWT token and UI reflect the ADMIN role.\n`);
  } catch (error) {
    console.error('❌ Error promoting user to admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
