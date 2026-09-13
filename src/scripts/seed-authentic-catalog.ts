import prisma from '../lib/prisma';
import { AUTHENTIC_CAMPUS_CATALOG } from '../data/authentic-catalog/items';
import { ProductType, AuctionStatus, ProductStatus } from '@prisma/client';

async function seedAuthenticCatalog() {
  const targetEmail = 'officialthakur94@gmail.com';
  console.log(`\n🌱 Starting authentic campus catalog seeding for: ${targetEmail}`);

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
  });

  if (!user) {
    console.error(`❌ Error: User with email "${targetEmail}" was not found.`);
    process.exit(1);
  }

  console.log(`👤 Found user: ${user.name} (${user.id}), Role: ${user.role}, College: ${user.college}`);

  let createdCount = 0;
  let auctionCount = 0;

  for (const item of AUTHENTIC_CAMPUS_CATALOG) {
    // Check if product already exists with same title for this user
    let product = await prisma.product.findFirst({
      where: {
        ownerId: user.id,
        title: item.title,
      },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          title: item.title,
          description: item.description,
          price: item.price,
          type: item.type as ProductType,
          category: item.category,
          imageUrl: item.imageUrl,
          status: ProductStatus.AVAILABLE,
          serviceDuration: item.serviceDuration,
          deliverySlots: item.deliverySlots,
          frequency: item.frequency,
          ownerId: user.id,
        },
      });
      createdCount++;
      console.log(`  ✓ Created Product: "${product.title}" (₹${product.price}) - [${product.type}]`);
    } else {
      console.log(`  ℹ️ Product already exists: "${product.title}"`);
    }

    // If AUCTION type, ensure Auction record exists
    if (item.type === 'AUCTION') {
      const existingAuction = await prisma.auction.findUnique({
        where: { productId: product.id },
      });

      if (!existingAuction) {
        const durationHours = item.durationHours || 48;
        const endTime = new Date(Date.now() + durationHours * 3600 * 1000);
        const startingBid = item.startingBid || item.price;

        const auction = await prisma.auction.create({
          data: {
            productId: product.id,
            sellerId: user.id,
            startingBid: startingBid,
            currentBid: startingBid,
            minIncrement: item.minIncrement || 100,
            reservePrice: item.reservePrice,
            startTime: new Date(),
            endTime: endTime,
            antiSnipingSeconds: item.antiSnipingSeconds || 60,
            status: AuctionStatus.ACTIVE,
          },
        });
        auctionCount++;
        console.log(`    🔨 Created LIVE Auction: ID ${auction.id}, Ends: ${endTime.toISOString()}`);
      }
    }
  }

  console.log(`\n🎉 Seeding Complete!`);
  console.log(`   Total Products Created: ${createdCount}`);
  console.log(`   Total Live Auctions Created: ${auctionCount}`);
  console.log(`   Owned by: ${user.name} (${user.email})\n`);
}

seedAuthenticCatalog()
  .catch((err) => {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
