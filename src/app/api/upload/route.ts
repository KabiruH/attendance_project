// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFiles = [];

    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'public', 'uploads');

    // Handle ID Card
    const idCard = formData.get('id_card') as File;
    if (idCard) {
      const idCardBytes = await idCard.arrayBuffer();
      const idCardBuffer = Buffer.from(idCardBytes);
      const idCardFileName = `id_card_${Date.now()}_${idCard.name}`;
      const idCardPath = join(uploadDir, idCardFileName);
      await writeFile(idCardPath, idCardBuffer);
      uploadedFiles.push({ field: 'id_card_path', path: `/uploads/${idCardFileName}` });
    }

    // Handle Passport Photo
    const passportPhoto = formData.get('passport_photo') as File;
    if (passportPhoto) {
      const passportBytes = await passportPhoto.arrayBuffer();
      const passportBuffer = Buffer.from(passportBytes);
      const passportFileName = `passport_${Date.now()}_${passportPhoto.name}`;
      const passportPath = join(uploadDir, passportFileName);
      await writeFile(passportPath, passportBuffer);
      uploadedFiles.push({ field: 'passport_photo_path', path: `/uploads/${passportFileName}` });
    }

    return NextResponse.json({
      id_card_path: uploadedFiles.find(f => f.field === 'id_card_path')?.path || '',
      passport_photo_path: uploadedFiles.find(f => f.field === 'passport_photo_path')?.path || ''
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Error uploading file' },
      { status: 500 }
    );
  }
}