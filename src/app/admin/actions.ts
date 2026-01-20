'use server'

import { db } from '@/lib/db';
import { generateToken } from '@/lib/utils';
import { hashPassword } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { SubData } from '@/lib/database/interface';

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
        upstreamUserAgent: (formData.get('upstreamUserAgent') as string) || undefined,
        customBackgroundUrl: (formData.get('customBackgroundUrl') as string) || undefined,
        announcement: (formData.get('announcement') as string) || undefined,
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

    // Trigger cleanup immediately
    if (logRetentionDays > 0) {
        await db.cleanupLogs(logRetentionDays);
    }

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

export async function clearLogs(days: number = 30) {
    if (days < 0) return { error: 'Invalid retention days' };

    if (days === 0) {
        await db.deleteAllLogs();
    } else {
        await db.cleanupLogs(days);
    }

    revalidatePath('/admin/logs');
    revalidatePath('/admin/settings');
    return { success: true };
}

// User Management
export async function getUsers(page: number = 1, limit: number = 10, search?: string) {
    return await db.getAllUsers(page, limit, search);
}

export async function createUser(formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const nickname = formData.get('nickname') as string;
    const rules = formData.get('customRules') as string;
    const role = (formData.get('role') as string) || 'user';
    const status = 'active';

    if (!username || !password) return { error: 'Missing fields' };

    // Check existing
    if (await db.userExists(username)) {
        return { error: 'User already exists' };
    }

    const hashedPassword = await hashPassword(password);

    // 1. Create User
    await db.setUser(username, {
        id: '', // Will be generated by database
        username,
        password: hashedPassword,
        role,
        status,
        maxSubscriptions: null, // null = follow global settings
        nickname: nickname || undefined,
        createdAt: Date.now()
    });

    // Check subscription limit before creating default subscription
    const user = await db.getUser(username);
    const config = await db.getGlobalConfig();
    const userLimit = user?.maxSubscriptions ?? config.maxUserSubscriptions ?? 10;
    const currentSubs = await db.getUserSubscriptions(username);

    if (currentSubs.length >= userLimit) {
        // User created but can't create subscription due to limit
        return { error: `用户已创建，但无法创建订阅：已达订阅上限 (${userLimit})` };
    }

    // Get default or first upstream source
    const upstreamSources = await db.getUpstreamSources();
    let selectedSources: string[] = [];

    if (upstreamSources.length > 0) {
        // Find default source
        const defaultSource = upstreamSources.find(s => s.isDefault);
        if (defaultSource) {
            selectedSources = [defaultSource.name];
        } else {
            // Use first source if no default
            selectedSources = [upstreamSources[0].name];
        }
    }

    // 2. Create Default Subscription
    const token = generateToken();
    const subData: SubData = {
        username,
        remark: '默认订阅',
        customRules: rules || '',
        groupId: 'default',
        ruleId: 'default',
        selectedSources, // Only default or first source
        enabled: true,
        createdAt: Date.now()
    };
    await db.createSubscription(token, username, subData);

    revalidatePath('/admin');
    return { success: true };
}

export async function updateUserStatus(username: string, status: string) {
    const user = await db.getUser(username);
    if (user) {
        user.status = status;
        await db.setUser(username, user);
        revalidatePath('/admin');
    }
}

export async function updateUserMaxSubscriptions(username: string, maxSubscriptions: number | null) {
    const user = await db.getUser(username);
    if (user) {
        user.maxSubscriptions = maxSubscriptions;
        await db.setUser(username, user);
        revalidatePath('/admin');
    }
}

export async function updateUser(oldUsername: string, newUsername: string, newPassword?: string, nickname?: string) {
    // Get existing user data
    const user = await db.getUser(oldUsername);
    if (!user) return { error: 'User not found' };

    // If username changed, check if new username exists
    if (oldUsername !== newUsername) {
        if (await db.userExists(newUsername)) {
            return { error: '新用户名已存在' };
        }

        // Update password if provided
        if (newPassword) {
            user.password = await hashPassword(newPassword);
        }

        // Update nickname
        user.nickname = nickname || undefined;

        // 1. Create new user record
        await db.setUser(newUsername, user);

        // 2. Migrate subscriptions
        const subs = await db.getUserSubscriptions(oldUsername);
        for (const sub of subs) {
            const token = sub.token;
            const { token: _, ...subData } = sub;
            subData.username = newUsername;
            await db.updateSubscription(token, subData);
        }

        // 3. Delete old user
        await db.deleteUser(oldUsername);
    } else {
        // Just password/nickname update
        if (newPassword) {
            user.password = await hashPassword(newPassword);
        }
        user.nickname = nickname || undefined;
        await db.setUser(oldUsername, user);
    }

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
}

export async function deleteUser(username: string) {
    // Delete all subscriptions for this user first
    const userSubs = await db.getUserSubscriptions(username);
    for (const sub of userSubs) {
        await db.deleteSubscription(sub.token, username);
    }

    // Delete avatar if exists
    const user = await db.getUser(username);
    if (user && user.avatar) {
        try {
            const { StorageFactory } = await import('@/lib/storage');
            const storage = await StorageFactory.createFromGlobalConfig();
            await storage.delete(user.avatar);
        } catch (error) {
            console.warn('Failed to delete user avatar:', error);
        }
    }

    // Then delete the user
    await db.deleteUser(username);
    revalidatePath('/admin/users');
}

export async function adminUploadAvatar(formData: FormData) {
    const username = formData.get('username') as string;
    const file = formData.get('avatar') as File;

    if (!username || !file) {
        return { error: 'Missing required fields' };
    }

    // Check file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        return { error: '文件大小不能超过 10MB' };
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
        return { error: '只支持图片文件' };
    }

    try {
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate and process image
        const { ImageProcessor } = await import('@/lib/image-processor');
        const isValid = await ImageProcessor.validateImage(buffer);
        if (!isValid) {
            return { error: '无效的图片文件' };
        }

        // Process image (resize to 500x500, convert to WebP)
        const processedBuffer = await ImageProcessor.processAvatar(buffer, 500);

        // Get user
        const user = await db.getUser(username);
        if (!user) {
            return { error: '用户不存在' };
        }

        // Delete old avatar if exists
        if (user.avatar) {
            try {
                const { StorageFactory } = await import('@/lib/storage');
                const storage = await StorageFactory.createFromGlobalConfig();
                await storage.delete(user.avatar);
            } catch (error) {
                console.warn('Failed to delete old avatar:', error);
            }
        }

        // Upload new avatar
        const { StorageFactory } = await import('@/lib/storage');
        const storage = await StorageFactory.createFromGlobalConfig();
        const avatarUrl = await storage.upload(
            processedBuffer,
            `${user.id}-${Date.now()}`,
            'image/webp'
        );

        // Update user avatar in database
        await db.setUser(username, {
            ...user,
            avatar: avatarUrl,
        });

        revalidatePath('/admin/users');
        return { success: true, avatarUrl };
    } catch (error) {
        console.error('Admin avatar upload error:', error);
        return { error: '上传失败，请稍后重试' };
    }
}

export async function adminDeleteAvatar(username: string) {
    // Get user
    const user = await db.getUser(username);
    if (!user) {
        return { error: '用户不存在' };
    }

    if (!user.avatar) {
        return { error: '该用户未设置头像' };
    }

    try {
        // Delete avatar from storage
        const { StorageFactory } = await import('@/lib/storage');
        const storage = await StorageFactory.createFromGlobalConfig();
        await storage.delete(user.avatar);
    } catch (error) {
        console.warn('Failed to delete avatar from storage:', error);
    }

    // Update user avatar in database
    await db.setUser(username, {
        ...user,
        avatar: undefined,
    });

    revalidatePath('/admin/users');
    return { success: true };
}
