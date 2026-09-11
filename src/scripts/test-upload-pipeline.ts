import prisma from '../lib/prisma';
import { uploadService } from '../modules/upload/upload.service';
import { userService } from '../modules/users/user.service';
import { productService } from '../modules/products/product.service';
import { Role, ProductType } from '@prisma/client';

async function runUploadPipelineTest() {
  const timestamp = Date.now();
  const testEmail = `student_upload_${timestamp}@test.edu`;

  const user = await prisma.user.upsert({
    where: { email: testEmail },
    update: {},
    create: {
      name: 'Test Uploader',
      email: testEmail,
      phone: `91${timestamp.toString().slice(-8)}`,
      college: 'IIT Delhi',
      branch: 'Design',
      year: '2nd Year',
      password: 'hash',
      role: Role.USER,
      isVerified: true,
    },
  });

  const signUrlResult = await uploadService.getSignedUploadUrl(
    user.id,
    'avatar.png',
    'image/png',
    'avatars'
  );

  if (!signUrlResult.path || !signUrlResult.publicUrl) {
    throw new Error('Sign URL response missing path or publicUrl');
  }

  const dummyImageBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const directUploadResult = await uploadService.saveDirectUpload(
    user.id,
    {
      originalname: 'test_product.png',
      mimetype: 'image/png',
      buffer: dummyImageBuffer,
      size: dummyImageBuffer.length,
    },
    'products'
  );

  if (!directUploadResult.publicUrl) {
    throw new Error('Direct upload result missing publicUrl');
  }

  const updatedUser = await userService.updateProfile(user.id, {
    name: 'Test Uploader Updated',
    image: directUploadResult.publicUrl,
  });

  if (updatedUser.profileImage !== directUploadResult.publicUrl) {
    throw new Error(`Profile image not updated properly. Expected: ${directUploadResult.publicUrl}, Got: ${updatedUser.profileImage}`);
  }

  const product = await productService.createProduct(
    user.id,
    {
      title: 'Ergonomic Desk Chair',
      description: 'Used for one semester, excellent condition with lumbar support',
      price: 1500,
      category: 'FURNITURE',
      type: ProductType.SELL,
      imageUrl: directUploadResult.publicUrl,
    }
  );

  if (product.imageUrl !== directUploadResult.publicUrl) {
    throw new Error(`Product image URL not stored properly. Expected: ${directUploadResult.publicUrl}, Got: ${product.imageUrl}`);
  }

  console.log('--- ALL UPLOAD PIPELINE TESTS PASSED ---');
  console.log(JSON.stringify({
    provider: signUrlResult.provider,
    avatarPublicUrl: updatedUser.profileImage,
    productTitle: product.title,
    productImageUrl: product.imageUrl,
  }, null, 2));

  await prisma.product.delete({ where: { id: product.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

runUploadPipelineTest()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
