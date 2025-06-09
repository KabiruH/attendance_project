// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary only if environment variables exist
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Check if we're in production/cloud environment
const isProduction = process.env.NODE_ENV === 'production' && process.env.CLOUDINARY_CLOUD_NAME;

async function uploadToCloudinary(buffer: Buffer, filename: string, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: `attendance_app/${folder}`,
        public_id: `${Date.now()}_${filename.replace(/\.[^/.]+$/, "")}`,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result?.secure_url || '');
      }
    ).end(buffer);
  });
}

async function uploadToLocal(buffer: Buffer, filename: string, uploadDir: string): Promise<string> {
  // Ensure upload directory exists
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }
  
  const filePath = join(uploadDir, filename);
  await writeFile(filePath, buffer);
  return `/uploads/${filename}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFiles = [];
    
    // Local upload directory (only used in development)
    const uploadDir = join(process.cwd(), 'public', 'uploads');

    // Handle ID Card
    const idCard = formData.get('id_card') as File;
    if (idCard) {
      const idCardBytes = await idCard.arrayBuffer();
      const idCardBuffer = Buffer.from(idCardBytes);
      const idCardFileName = `id_card_${Date.now()}_${idCard.name}`;
      
      let idCardPath: string;
      
      if (isProduction) {
        // Upload to Cloudinary in production
        console.log('Uploading ID card to Cloudinary...');
        idCardPath = await uploadToCloudinary(idCardBuffer, idCardFileName, 'id_cards');
      } else {
        // Upload to local filesystem in development
        console.log('Uploading ID card locally...');
        idCardPath = await uploadToLocal(idCardBuffer, idCardFileName, uploadDir);
      }
      
      uploadedFiles.push({ field: 'id_card_path', path: idCardPath });
    }

    // Handle Passport Photo
    const passportPhoto = formData.get('passport_photo') as File;
    if (passportPhoto) {
      const passportBytes = await passportPhoto.arrayBuffer();
      const passportBuffer = Buffer.from(passportBytes);
      const passportFileName = `passport_${Date.now()}_${passportPhoto.name}`;
      
      let passportPath: string;
      
      if (isProduction) {
        // Upload to Cloudinary in production
        console.log('Uploading passport photo to Cloudinary...');
        passportPath = await uploadToCloudinary(passportBuffer, passportFileName, 'passport_photos');
      } else {
        // Upload to local filesystem in development
        console.log('Uploading passport photo locally...');
        passportPath = await uploadToLocal(passportBuffer, passportFileName, uploadDir);
      }
      
      uploadedFiles.push({ field: 'passport_photo_path', path: passportPath });
    }

    console.log(`Upload successful using ${isProduction ? 'Cloudinary' : 'local filesystem'}`);

    return NextResponse.json({
      id_card_path: uploadedFiles.find(f => f.field === 'id_card_path')?.path || '',
      passport_photo_path: uploadedFiles.find(f => f.field === 'passport_photo_path')?.path || '',
      upload_method: isProduction ? 'cloudinary' : 'local'
    });

  } catch (error) {
  console.error('Upload error:', error);
  return NextResponse.json(
    { error: 'Error uploading file', details: (error as Error).message },
    { status: 500 }
  );
}
}