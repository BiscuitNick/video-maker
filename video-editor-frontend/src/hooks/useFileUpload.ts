import { useState, useCallback } from 'react';
import type { MediaUploadProgress, UploadMediaResponse, ApiResponse } from '@/types';

interface UseFileUploadOptions {
  onSuccess?: (media: UploadMediaResponse) => void;
  onError?: (error: string) => void;
  maxFileSize?: number;
  allowedTypes?: string[];
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    onSuccess,
    onError,
    maxFileSize = 100 * 1024 * 1024,
    allowedTypes = ['video/*', 'image/*'],
  } = options;

  const [uploads, setUploads] = useState<MediaUploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxFileSize) {
      const sizeMB = Math.round(maxFileSize / (1024 * 1024));
      return 'File size exceeds ' + sizeMB + 'MB limit';
    }

    const fileType = file.type;
    const isAllowed = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        const prefix = type.split('/')[0];
        return fileType.startsWith(prefix + '/');
      }
      return fileType === type;
    });

    if (!isAllowed) {
      return 'File type ' + fileType + ' is not supported';
    }

    return null;
  }, [maxFileSize, allowedTypes]);

  const uploadFile = useCallback(async (file: File): Promise<UploadMediaResponse | null> => {
    const error = validateFile(file);
    if (error) {
      onError?.(error);
      return null;
    }

    const fileId = Date.now() + '-' + file.name;

    const initialProgress: MediaUploadProgress = {
      fileId,
      fileName: file.name,
      progress: 0,
      status: 'pending',
    };

    setUploads(prev => [...prev, initialProgress]);
    setIsUploading(true);

    try {
      setUploads(prev => prev.map(upload =>
        upload.fileId === fileId
          ? { ...upload, status: 'uploading' as const }
          : upload
      ));

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed: ' + response.statusText);
      }

      const result: ApiResponse<UploadMediaResponse> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploads(prev => prev.map(upload =>
        upload.fileId === fileId
          ? { ...upload, progress: 100, status: 'completed' as const }
          : upload
      ));

      onSuccess?.(result.data);

      setTimeout(() => {
        setUploads(prev => {
          const filtered = prev.filter(upload => upload.fileId !== fileId);
          if (filtered.length === 0) {
            setIsUploading(false);
          }
          return filtered;
        });
      }, 2000);

      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';

      setUploads(prev => prev.map(upload =>
        upload.fileId === fileId
          ? { ...upload, status: 'failed' as const, error: errorMessage }
          : upload
      ));

      onError?.(errorMessage);

      setTimeout(() => {
        setUploads(prev => {
          const filtered = prev.filter(upload => upload.fileId !== fileId);
          if (filtered.length === 0) {
            setIsUploading(false);
          }
          return filtered;
        });
      }, 3000);

      return null;
    }
  }, [validateFile, onSuccess, onError]);

  const uploadFiles = useCallback(async (files: File[]): Promise<UploadMediaResponse[]> => {
    const results = await Promise.all(files.map(file => uploadFile(file)));
    return results.filter((result): result is UploadMediaResponse => result !== null);
  }, [uploadFile]);

  const uploadFromUrl = useCallback(async (url: string): Promise<UploadMediaResponse | null> => {
    const fileId = 'url-' + Date.now();

    const initialProgress: MediaUploadProgress = {
      fileId,
      fileName: url,
      progress: 0,
      status: 'pending',
    };

    setUploads(prev => [...prev, initialProgress]);
    setIsUploading(true);

    try {
      setUploads(prev => prev.map(upload =>
        upload.fileId === fileId
          ? { ...upload, status: 'uploading' as const }
          : upload
      ));

      const response = await fetch('/api/media/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Upload failed: ' + response.statusText);
      }

      const result: ApiResponse<UploadMediaResponse> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploads(prev => prev.map(upload =>
        upload.fileId === fileId
          ? { ...upload, progress: 100, status: 'completed' as const }
          : upload
      ));

      onSuccess?.(result.data);

      setTimeout(() => {
        setUploads(prev => {
          const filtered = prev.filter(upload => upload.fileId !== fileId);
          if (filtered.length === 0) {
            setIsUploading(false);
          }
          return filtered;
        });
      }, 2000);

      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';

      setUploads(prev => prev.map(upload =>
        upload.fileId === fileId
          ? { ...upload, status: 'failed' as const, error: errorMessage }
          : upload
      ));

      onError?.(errorMessage);

      setTimeout(() => {
        setUploads(prev => {
          const filtered = prev.filter(upload => upload.fileId !== fileId);
          if (filtered.length === 0) {
            setIsUploading(false);
          }
          return filtered;
        });
      }, 3000);

      return null;
    }
  }, [onSuccess, onError]);

  const clearUploads = useCallback(() => {
    setUploads([]);
    setIsUploading(false);
  }, []);

  return {
    uploads,
    isUploading,
    uploadFile,
    uploadFiles,
    uploadFromUrl,
    clearUploads,
  };
}
