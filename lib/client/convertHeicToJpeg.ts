const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];

export async function convertHeicToJpegIfNeeded(file: File): Promise<File> {
  const isHeic =
    HEIC_MIME_TYPES.includes(file.type) || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);

  if (!isHeic) {
    return file;
  }

  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');

  return new File([blob], newName, { type: 'image/jpeg' });
}
