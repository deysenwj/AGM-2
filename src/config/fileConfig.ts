// src/config/fileConfig.ts

export const FILE_CONFIG = {
  // Single centralized maximum file size constant (10 MB)
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_FILE_SIZE_MB: 10,

  // Supported MIME Types for Phase 1
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],

  // Supported File Extensions for Phase 1
  ALLOWED_EXTENSIONS: ['.pdf', '.txt', '.docx', '.csv', '.xlsx'],

  // Maximum characters sent to AI prompt for attachment content context
  MAX_CONTEXT_CHARS: 30000
};

export const isValidFileExtension = (filename: string): boolean => {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return FILE_CONFIG.ALLOWED_EXTENSIONS.includes(ext);
};

export const isValidMimeType = (mimeType: string): boolean => {
  if (!mimeType) return false;
  return FILE_CONFIG.ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase());
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
