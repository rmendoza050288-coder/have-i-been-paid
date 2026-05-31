import { NextResponse } from 'next/server';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tmpIn  = join(tmpdir(), `heic_in_${id}.heic`);
  const tmpOut = join(tmpdir(), `heic_out_${id}.jpg`);

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tmpIn, buffer);

    // sips is macOS built-in; converts HEIC/HEIF → JPEG via native codec
    await execAsync(`sips -s format jpeg ${JSON.stringify(tmpIn)} --out ${JSON.stringify(tmpOut)}`);

    const jpegBuffer = await readFile(tmpOut);
    const base64 = jpegBuffer.toString('base64');
    return NextResponse.json({ base64, mimeType: 'image/jpeg' });
  } catch (err) {
    console.error('[heic-convert]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await Promise.all([
      unlink(tmpIn).catch(() => {}),
      unlink(tmpOut).catch(() => {}),
    ]);
  }
}
