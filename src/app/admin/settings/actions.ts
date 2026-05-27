'use server'

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-guard';
import { UaFilterConfig } from '@/lib/database/interface';

// Global Config
export async function getGlobalConfig() {
    await requireAdmin();
    return await db.getGlobalConfig();
}

export async function updateUaFilter(uaFilter: UaFilterConfig) {
    await requireAdmin();
    const existingConfig = await db.getGlobalConfig();
    await db.setGlobalConfig({
        ...existingConfig,
        uaFilter,
    });
    revalidatePath('/admin/settings');
}

export async function updateUserLimits(maxUserSubscriptions: number) {
    await requireAdmin();
    const existingConfig = await db.getGlobalConfig();
    await db.setGlobalConfig({
        ...existingConfig,
        maxUserSubscriptions,
    });
    revalidatePath('/admin/settings');
}

export async function updateNetworkSettings(upstreamUserAgent: string) {
    await requireAdmin();
    const existingConfig = await db.getGlobalConfig();
    await db.setGlobalConfig({
        ...existingConfig,
        upstreamUserAgent,
    });
    revalidatePath('/admin/settings');
}

export async function updateAppearance(customBackgroundUrl: string) {
    await requireAdmin();
    const existingConfig = await db.getGlobalConfig();
    await db.setGlobalConfig({
        ...existingConfig,
        customBackgroundUrl,
    });
    revalidatePath('/');
    revalidatePath('/admin/settings');
}

export async function updateAnnouncement(announcement: string) {
    await requireAdmin();
    const existingConfig = await db.getGlobalConfig();
    await db.setGlobalConfig({
        ...existingConfig,
        announcement,
    });
    revalidatePath('/');
    revalidatePath('/admin/settings');
}

export async function updateStorageConfig(storage: {
    storageProvider: 'local' | 's3';
    localStoragePath?: string;
    s3Preset?: string;
    s3Endpoint?: string;
    s3Region?: string;
    s3AccessKeyId?: string;
    s3SecretAccessKey?: string;
    s3BucketName?: string;
    s3PublicDomain?: string;
    s3FolderPath?: string;
    s3AccountId?: string;
}) {
    await requireAdmin();
    const existingConfig = await db.getGlobalConfig();
    await db.setGlobalConfig({
        ...existingConfig,
        storageProvider: storage.storageProvider || existingConfig.storageProvider || 'local',
        localStoragePath: storage.localStoragePath?.trim() || existingConfig.localStoragePath,
        s3Preset: (storage.s3Preset?.trim() as any) || existingConfig.s3Preset,
        s3Endpoint: storage.s3Endpoint?.trim() || existingConfig.s3Endpoint,
        s3Region: storage.s3Region?.trim() || existingConfig.s3Region,
        s3AccessKeyId: storage.s3AccessKeyId?.trim() || existingConfig.s3AccessKeyId,
        s3SecretAccessKey: storage.s3SecretAccessKey?.trim() || existingConfig.s3SecretAccessKey,
        s3BucketName: storage.s3BucketName?.trim() || existingConfig.s3BucketName,
        s3PublicDomain: storage.s3PublicDomain?.trim() || existingConfig.s3PublicDomain,
        s3FolderPath: storage.s3FolderPath?.trim() || existingConfig.s3FolderPath,
        s3AccountId: storage.s3AccountId?.trim() || existingConfig.s3AccountId,
    });
    revalidatePath('/admin/settings');
}

export async function testS3Connection(formData: FormData) {
    await requireAdmin();
    try {
        const preset = (formData.get('s3Preset') as string)?.trim();
        const accessKeyId = (formData.get('s3AccessKeyId') as string)?.trim();
        const secretAccessKey = (formData.get('s3SecretAccessKey') as string)?.trim();
        const bucketName = (formData.get('s3BucketName') as string)?.trim();
        const region = ((formData.get('s3Region') as string)?.trim()) || 'auto';
        const folderPath = ((formData.get('s3FolderPath') as string)?.trim()) || 'avatars';
        let endpoint = (formData.get('s3Endpoint') as string)?.trim();

        const accountId = (formData.get('s3AccountId') as string)?.trim();

        // Build endpoint based on preset if not provided
        if (!endpoint) {
            // Validation
            if (preset === 'cloudflare-r2' && !accountId) {
                return { success: false, error: 'r2NeedAccountId' };
            }

            const { buildS3Endpoint } = await import('@/lib/storage');
            endpoint = buildS3Endpoint(preset, accountId, region);

            if (!endpoint) {
                return { success: false, error: 'endpointRequired' };
            }
        }

        if (!accessKeyId || !secretAccessKey || !bucketName) {
            return { success: false, error: 's3ConfigRequired' };
        }

        // Import S3 client
        const { S3Client, ListObjectsV2Command, PutObjectCommand } = await import('@aws-sdk/client-s3');

        // Create S3 client
        const client = new S3Client({
            region,
            endpoint,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });

        let listError: string | null = null;

        // Test 1: List objects (verify bucket access)
        try {
            await client.send(new ListObjectsV2Command({
                Bucket: bucketName,
                MaxKeys: 1,
            }));
        } catch (error: any) {
            console.warn('S3 ListObjects failed (non-fatal):', error);
            listError = error.message;
        }

        // Test 2: Upload a test file (Critical)
        try {
            const testContent = Buffer.from('S3 connection test');
            const testKey = `${folderPath}/test-connection.txt`;

            await client.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: testKey,
                Body: testContent,
                ContentType: 'text/plain',
            }));

            // If upload succeeds, we consider it a success
            return {
                success: true,
                message: listError
                    ? `s3ConnectedWithListError:${listError}`
                    : 's3Connected'
            };
        } catch (error: any) {
            console.error('S3 PutObject failed:', error);
            throw error; // Re-throw to be caught by outer catch block
        }
    } catch (error: any) {
        console.error('S3 connection test failed:', error);

        let errorMessage = 'connectionFailed';
        if (error.name === 'NoSuchBucket') {
            errorMessage = 'bucketNotFound';
        } else if (error.name === 'InvalidAccessKeyId') {
            errorMessage = 'invalidAccessKeyId';
        } else if (error.name === 'SignatureDoesNotMatch') {
            errorMessage = 'invalidSecretKey';
        } else if (error.Code === 'Unauthorized' || error.$metadata?.httpStatusCode === 401) {
            errorMessage = 'authFailed';
        } else if (error.message) {
            errorMessage = error.message;
        }

        return {
            success: false,
            error: errorMessage
        };
    }
}

export async function clearCache() {
    await requireAdmin();
    await db.deleteCache('cache:subscription');
    revalidatePath('/admin');
}

export async function cleanupSessions() {
    await requireAdmin();
    const count = await db.cleanupExpiredSessions();
    return { count };
}

export async function clearLogs(days: number = 30, logTypes: string[] = ['api', 'web', 'system']) {
    await requireAdmin();
    if (days < 0) return { error: 'Invalid retention days' };

    await db.cleanupLogs(days, logTypes);

    revalidatePath('/admin/logs');
    revalidatePath('/admin/settings');
    return { success: true };
}

// OAuth Provider management
export async function saveOAuthProvider(id: string | null, data: {
    name: string;
    type: 'google' | 'github' | 'custom';
    icon?: string;
    clientId: string;
    clientSecret: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    userInfoUrl?: string;
    scope?: string;
    enabled: boolean;
}) {
    await requireAdmin();
    const providerId = id || crypto.randomUUID().replace(/-/g, '').slice(0, 21);
    await db.setOAuthProvider(providerId, {
        ...data,
        id: providerId,
        createdAt: Date.now()
    });
    revalidatePath('/admin/settings');
    return { success: true, id: providerId };
}

export async function deleteOAuthProvider(id: string) {
    await requireAdmin();
    await db.deleteOAuthProvider(id);
    revalidatePath('/admin/settings');
}

export async function updateOAuthAllowAutoCreate(allow: boolean) {
    await requireAdmin();
    const existingConfig = await db.getGlobalConfig();
    await db.setGlobalConfig({
        ...existingConfig,
        oauthAllowAutoCreate: allow,
    });
    revalidatePath('/admin/settings');
}
