'use server'

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// Global Config
export async function getGlobalConfig() {
    return await db.getGlobalConfig();
}

export async function updateGlobalConfig(formData: FormData) {
    // Get existing config to preserve other settings
    const existingConfig = await db.getGlobalConfig();

    const logRetentionDays = parseInt(formData.get('logRetentionDays') as string);

    // Parse maxUserSubscriptions, preserve existing value if not provided
    const maxUserSubscriptionsStr = formData.get('maxUserSubscriptions') as string;
    const maxUserSubscriptions = maxUserSubscriptionsStr
        ? parseInt(maxUserSubscriptionsStr) || 10
        : existingConfig.maxUserSubscriptions;

    // Parse UA filter config
    const uaFilterStr = formData.get('uaFilter') as string;
    const uaFilter = uaFilterStr ? JSON.parse(uaFilterStr) : existingConfig.uaFilter;

    await db.setGlobalConfig({
        maxUserSubscriptions,
        logRetentionDays,
        uaFilter,  // Add UA filter config
        refreshApiKey: existingConfig.refreshApiKey,
        upstreamLastUpdated: existingConfig.upstreamLastUpdated,
        upstreamUserAgent: formData.get('upstreamUserAgent') !== null ? (formData.get('upstreamUserAgent') as string) : undefined,
        customBackgroundUrl: formData.get('customBackgroundUrl') !== null ? (formData.get('customBackgroundUrl') as string) : undefined,
        announcement: formData.get('announcement') !== null ? (formData.get('announcement') as string) : undefined,
        // Unified S3 storage configuration
        storageProvider: (formData.get('storageProvider') as 'local' | 's3') || existingConfig.storageProvider || 'local',
        localStoragePath: (formData.get('localStoragePath') as string)?.trim() || existingConfig.localStoragePath,
        s3Preset: (formData.get('s3Preset') as any)?.trim() || existingConfig.s3Preset,
        s3Endpoint: (formData.get('s3Endpoint') as string)?.trim() || existingConfig.s3Endpoint,
        s3Region: (formData.get('s3Region') as string)?.trim() || existingConfig.s3Region,
        s3AccessKeyId: (formData.get('s3AccessKeyId') as string)?.trim() || existingConfig.s3AccessKeyId,
        s3SecretAccessKey: (formData.get('s3SecretAccessKey') as string)?.trim() || existingConfig.s3SecretAccessKey,
        s3BucketName: (formData.get('s3BucketName') as string)?.trim() || existingConfig.s3BucketName,
        s3PublicDomain: (formData.get('s3PublicDomain') as string)?.trim() || existingConfig.s3PublicDomain,
        s3FolderPath: (formData.get('s3FolderPath') as string)?.trim() || existingConfig.s3FolderPath,
        s3AccountId: (formData.get('s3AccountId') as string)?.trim() || existingConfig.s3AccountId,
    });

    // Revalidate home page cache if background URL changed
    const oldBg = existingConfig.customBackgroundUrl;
    const newBg = (formData.get('customBackgroundUrl') as string) || undefined;
    if (oldBg !== newBg) {
        revalidatePath('/');
    }

    // Always revalidate home page for announcement
    revalidatePath('/');

    revalidatePath('/admin');
    revalidatePath('/admin/settings');
}

export async function testS3Connection(formData: FormData) {
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
                return { success: false, error: 'R2 需要 Account ID' };
            }

            const { buildS3Endpoint } = await import('@/lib/storage');
            endpoint = buildS3Endpoint(preset, accountId, region);

            if (!endpoint) {
                return { success: false, error: '请填写 Endpoint 或选择预设' };
            }
        }

        if (!accessKeyId || !secretAccessKey || !bucketName) {
            return { success: false, error: '请填写所有必需的 S3 配置' };
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
                    ? `连接成功！但在列出文件时遇到错误 (${listError})，这通常是因为权限限制。上传功能可用。`
                    : '连接成功！已验证读写权限。'
            };
        } catch (error: any) {
            console.error('S3 PutObject failed:', error);
            throw error; // Re-throw to be caught by outer catch block
        }
    } catch (error: any) {
        console.error('S3 connection test failed:', error);

        let errorMessage = '连接失败';
        if (error.name === 'NoSuchBucket') {
            errorMessage = '存储桶不存在';
        } else if (error.name === 'InvalidAccessKeyId') {
            errorMessage = 'Access Key ID 无效';
        } else if (error.name === 'SignatureDoesNotMatch') {
            errorMessage = 'Secret Access Key 无效';
        } else if (error.Code === 'Unauthorized' || error.$metadata?.httpStatusCode === 401) {
            errorMessage = '认证失败 (Unauthorized)。请检查凭据和权限。';
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
    await db.deleteCache('cache:subscription');
    revalidatePath('/admin');
}

export async function cleanupSessions() {
    const count = await db.cleanupExpiredSessions();
    return { count };
}

export async function clearLogs(days: number = 30, logTypes: string[] = ['api', 'web', 'system']) {
    if (days < 0) return { error: 'Invalid retention days' };

    await db.cleanupLogs(days, logTypes);

    revalidatePath('/admin/logs');
    revalidatePath('/admin/settings');
    return { success: true };
}
