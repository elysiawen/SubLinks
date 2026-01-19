import { IStorageProvider } from './interface';
import fs from 'fs/promises';
import path from 'path';

/**
 * Local filesystem storage provider
 */
export class LocalStorageProvider implements IStorageProvider {
    private storagePath: string;
    private publicPath: string;

    constructor(storagePath: string = '/uploads/avatars') {
        // Remove leading slash for path.join
        const cleanPath = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath;
        this.storagePath = path.join(process.cwd(), 'public', cleanPath);
        this.publicPath = storagePath;
    }

    async upload(file: Buffer, filename: string, contentType: string): Promise<string> {
        try {
            // Ensure directory exists
            await fs.mkdir(this.storagePath, { recursive: true });

            // Determine file extension based on content type
            const ext = this.getExtension(contentType);
            const fullFilename = `${filename}${ext}`;
            const filePath = path.join(this.storagePath, fullFilename);

            // Write file
            await fs.writeFile(filePath, file);

            // Return public URL
            return this.getPublicUrl(fullFilename);
        } catch (error) {
            console.error('Local storage upload error:', error);
            throw new Error('Failed to upload file to local storage');
        }
    }

    async delete(url: string): Promise<void> {
        try {
            // Extract filename from URL
            const filename = url.split('/').pop();
            if (!filename) {
                throw new Error('Invalid URL');
            }

            const filePath = path.join(this.storagePath, filename);

            // Check if file exists
            try {
                await fs.access(filePath);
                await fs.unlink(filePath);
            } catch (error) {
                // File doesn't exist, ignore
                console.warn('File not found for deletion:', filePath);
            }
        } catch (error) {
            console.error('Local storage delete error:', error);
            throw new Error('Failed to delete file from local storage');
        }
    }

    getPublicUrl(filename: string): string {
        return `${this.publicPath}/${filename}`;
    }

    private getExtension(contentType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
        };
        return map[contentType] || '.webp';
    }
}
