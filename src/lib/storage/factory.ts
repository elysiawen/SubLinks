import { IStorageProvider, StorageConfig } from './interface';
import { LocalStorageProvider } from './local';
import { S3Provider } from './s3';
import { buildS3Endpoint } from './utils';

/**
 * Storage factory - creates storage provider based on configuration
 */
export class StorageFactory {
    static createProvider(config: StorageConfig): IStorageProvider {
        switch (config.provider) {
            case 'local':
                return new LocalStorageProvider(config.localStoragePath);

            case 's3':
                if (!config.s3AccessKeyId || !config.s3SecretAccessKey || !config.s3BucketName || !config.s3PublicDomain) {
                    throw new Error('Missing S3 configuration');
                }

                let endpoint = config.s3Endpoint;
                if (!endpoint) {
                    endpoint = buildS3Endpoint(config.s3Preset || '', config.s3AccountId, config.s3Region);
                }

                if (!endpoint) {
                    throw new Error('S3 Endpoint is required. Please check your preset or custom endpoint.');
                }

                const region = config.s3Region || 'auto';

                return new S3Provider(
                    endpoint,
                    region,
                    config.s3AccessKeyId,
                    config.s3SecretAccessKey,
                    config.s3BucketName,
                    config.s3PublicDomain,
                    config.s3FolderPath || 'avatars'
                );

            default:
                throw new Error(`Unsupported storage provider: ${config.provider}`);
        }
    }


    /**
     * Create provider from global config
     */
    static async createFromGlobalConfig(): Promise<IStorageProvider> {
        const { db } = await import('@/lib/db');
        const globalConfig = await db.getGlobalConfig();

        const config: StorageConfig = {
            provider: (globalConfig.storageProvider as 'local' | 's3') || 'local',
            localStoragePath: globalConfig.localStoragePath,
            s3Preset: globalConfig.s3Preset,
            s3Endpoint: globalConfig.s3Endpoint,
            s3Region: globalConfig.s3Region,
            s3AccessKeyId: globalConfig.s3AccessKeyId,
            s3SecretAccessKey: globalConfig.s3SecretAccessKey,
            s3BucketName: globalConfig.s3BucketName,
            s3PublicDomain: globalConfig.s3PublicDomain,
            s3FolderPath: globalConfig.s3FolderPath,
            s3AccountId: globalConfig.s3AccountId,
        };

        return StorageFactory.createProvider(config);
    }
}
