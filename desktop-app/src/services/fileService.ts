export interface FileUploadOptions {
  onProgress?: (progress: number) => void;
  onError?: (error: string) => void;
}

class FileService {
  private maxFileSize = 50 * 1024 * 1024; // 50MB
  private allowedTypes = ['image/png', 'image/jpeg', 'application/pdf', 'text/plain', 'text/markdown'];

  validateFile(file: File): { valid: boolean; error?: string } {
    if (file.size > this.maxFileSize) {
      return { valid: false, error: `فائل بہت بڑی ہے (زیادہ سے زیادہ ${this.maxFileSize / 1024 / 1024}MB)` };
    }

    if (!this.allowedTypes.includes(file.type)) {
      return { valid: false, error: 'یہ فائل کی قسم سپورٹ نہیں ہے' };
    }

    return { valid: true };
  }

  private async waitForBackend(maxAttempts: number = 20, delayMs: number = 500): Promise<void> {
    const backendUrl = await this.getBackendUrl();
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`${backendUrl}/api/health`);
        if (response.ok) return;
      } catch {
        // Keep waiting while Electron starts the backend.
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    throw new Error(`Local backend is offline at ${backendUrl}`);
  }

  private async getBackendUrl(): Promise<string> {
    try {
      return await (window as any).electronAPI?.getAppUrl?.() || 'http://127.0.0.1:3000';
    } catch {
      return 'http://127.0.0.1:3000';
    }
  }

  async uploadFile(file: File, userId: string, apiKeys: any, options?: FileUploadOptions): Promise<any> {
    try {
      const validation = this.validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      await this.waitForBackend();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
      formData.append('apiKeys', JSON.stringify(apiKeys));
      formData.append('message', 'Please analyze this uploaded file.');
      formData.append('activeProvider', localStorage.getItem('jarvis_active_provider') || 'groq');

      const xhr = new XMLHttpRequest();
      const backendUrl = await this.getBackendUrl();

      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            options?.onProgress?.(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              resolve({ success: true, message: 'فائل اپ لوڈ ہو گئی' });
            }
          } else {
            reject(new Error(`اپ لوڈ ناکام: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('اپ لوڈ میں خرابی'));
        });

        xhr.open('POST', `${backendUrl}/api/chat`);
        xhr.send(formData);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'اپ لوڈ ناکام';
      options?.onError?.(message);
      throw error;
    }
  }

  getFileIcon(file: File): string {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type === 'application/pdf') return '📄';
    if (file.type.startsWith('text/')) return '📝';
    return '📦';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export const fileService = new FileService();
