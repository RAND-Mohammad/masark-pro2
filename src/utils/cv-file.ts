export const CV_MAX_BYTES = 10 * 1024 * 1024;
export const CV_MIME_TYPES = ['application/pdf'];
export const PDF_ONLY_MESSAGE = 'يرجى رفع السيرة الذاتية بصيغة PDF فقط';

export function validateCvFile(file: { name: string; size?: number; mimeType?: string }): string | null {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'pdf') {
    return PDF_ONLY_MESSAGE;
  }
  if (file.size !== undefined && (!Number.isFinite(file.size) || file.size <= 0)) {
    return 'الملف فارغ أو حجمه غير صالح. اختر ملفًا آخر.';
  }
  if (file.size !== undefined && file.size > CV_MAX_BYTES) {
    return 'حجم الملف أكبر من 10 ميجابايت. اختر نسخة أصغر.';
  }
  if (file.mimeType && file.mimeType !== 'application/octet-stream' && file.mimeType !== 'application/pdf') {
    return PDF_ONLY_MESSAGE;
  }
  return null;
}

export function formatCvSize(size?: number): string {
  if (size === undefined) return 'الحجم غير متوفر';
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} كيلوبايت`;
  return `${(size / (1024 * 1024)).toFixed(1)} ميجابايت`;
}
