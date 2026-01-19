import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { IStorageProvider } from './interface';

/**
 * Generic S3-compatible storage provider
 * Supports Cloudflare R2, Tigris Data, AWS S3, MinIO, and other S3-compatible services
 */
export class S3Provider implements IStorageProvider {
    private client: S3Client;
    private bucketName: string;
    private publicDomain: string;
    private folder: string;

    constructor(
        endpoint: string,
        region: string,
        accessKeyId: string,
        secretAccessKey: string,
        bucketName: string,
        publicDomain: string,
        folder: string = 'avatars'
    ) {
        this.bucketName = bucketName.trim();
        this.publicDomain = publicDomain.trim();
        this.folder = (folder || 'avatars').trim();

        // Initialize S3 client
        this.client = new S3Client({
            region: region.trim(),
            endpoint: endpoint.trim(),
            credentials: {
                accessKeyId: accessKeyId.trim(),
                secretAccessKey: secretAccessKey.trim(),
            },
        });
    }

    async upload(file: Buffer, filename: string, contentType: string): Promise<string> {
        try {
            const ext = this.getExtension(contentType);
            const fullFilename = `${filename}${ext}`;
            const key = `${this.folder}/${fullFilename}`;

            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: file,
                ContentType: contentType,
            });

            await this.client.send(command);

            return this.getPublicUrl(fullFilename);
        } catch (error) {
            console.error('S3 upload error:', error);
            throw new Error('Failed to upload file to S3-compatible storage');
        }
    }

    async delete(url: string): Promise<void> {
        try {
            // Extract filename from URL
            const filename = url.split('/').pop();
            if (!filename) {
                throw new Error('Invalid URL');
            }

            const key = `${this.folder}/${filename}`;

            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.client.send(command);
        } catch (error) {
            console.error('S3 delete error:', error);
            // Don't throw error if file doesn't exist
            if ((error as any).name !== 'NoSuchKey') {
                throw new Error('Failed to delete file from S3-compatible storage');
            }
        }
    }

    getPublicUrl(filename: string): string {
        return `${this.publicDomain}/${this.folder}/${filename}`;
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
