export async function convertImageToWebp(file: File, maxBytes: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browser tidak dapat memproses foto.');
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((converted) => {
        if (converted) resolve(converted);
        else reject(new Error('Foto gagal dikonversi ke WebP.'));
      }, 'image/webp', 0.85);
    });
    if (blob.type !== 'image/webp') throw new Error('Browser tidak mendukung konversi ke WebP.');
    if (blob.size > maxBytes) throw new Error('Ukuran foto WebP setelah konversi melebihi batas.');
    const filename = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${filename}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
