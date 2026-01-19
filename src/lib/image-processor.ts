import sharp from 'sharp';

/**
 * Image processing utilities
 */
export class ImageProcessor {
    /**
     * Process and optimize avatar image
     * @param buffer - Image buffer
     * @param size - Target size (default: 500x500)
     * @returns Processed image buffer in WebP format
     */
    static async processAvatar(buffer: Buffer, size: number = 500): Promise<Buffer> {
        try {
            return await sharp(buffer)
                .resize(size, size, {
                    fit: 'cover',
                    position: 'center',
                })
                .webp({ quality: 90 })
                .toBuffer();
        } catch (error) {
            console.error('Image processing error:', error);
            throw new Error('Failed to process image');
        }
    }

    /**
     * Validate image file
     * @param buffer - Image buffer
     * @returns true if valid image
     */
    static async validateImage(buffer: Buffer): Promise<boolean> {
        try {
            const metadata = await sharp(buffer).metadata();
            // Check if it's a valid image format
            const validFormats = ['jpeg', 'png', 'webp'];
            return validFormats.includes(metadata.format || '');
        } catch (error) {
            return false;
        }
    }

    /**
     * Get image metadata
     * @param buffer - Image buffer
     * @returns Image metadata
     */
    static async getMetadata(buffer: Buffer) {
        return await sharp(buffer).metadata();
    }
}
