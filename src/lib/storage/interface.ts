/**
 * Storage Provider Interface
 * Defines the contract for all storage implementations
 */
export interface IStorageProvider {
    /**
     * Upload a file to storage
     * @param file - File buffer
     * @param filename - Desired filename (without extension)
     * @param contentType - MIME type of the file
     * @returns Public URL of the uploaded file
     */
    upload(file: Buffer, filename: string, contentType: string): Promise<string>;

    /**
     * Delete a file from storage
     * @param url - Public URL or filename of the file to delete
     */
    delete(url: string): Promise<void>;

    /**
     * Get public URL for a file
     * @param filename - Filename
     * @returns Public URL
     */
    getPublicUrl(filename: string): string;
}

/**
 * Storage configuration for different providers
 */
export interface StorageConfig {
    provider: 'local' | 's3';

    // Local storage config
    localStoragePath?: string;

    // Unified S3 config (supports R2, Tigris, AWS S3, MinIO, etc.)
    s3Preset?: 'cloudflare-r2' | 'tigris' | 'aws-s3' | 'minio' | 'custom';
    s3Endpoint?: string;
    s3Region?: string;
    s3AccessKeyId?: string;
    s3SecretAccessKey?: string;
    s3BucketName?: string;
    s3PublicDomain?: string;
    s3FolderPath?: string;
    s3AccountId?: string;  // For R2 endpoint construction
}
