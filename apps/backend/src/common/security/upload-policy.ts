import { extname } from 'path';

const ALLOWED_UPLOADS: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/vnd.ms-excel']
};

export function isAllowedUpload(fileName: string, mimeType: string): boolean {
  const extension = extname(fileName).toLowerCase();
  return Boolean(ALLOWED_UPLOADS[extension]?.includes(mimeType.toLowerCase()));
}
