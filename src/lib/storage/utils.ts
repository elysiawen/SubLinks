export const S3_PRESETS: Record<string, { name: string; endpoint?: string; needsAccountId?: boolean; defaultRegion: string }> = {
    'cloudflare-r2': {
        name: 'Cloudflare R2',
        needsAccountId: true,
        defaultRegion: 'auto',
    },
    'tigris': {
        name: 'Tigris Data',
        endpoint: 'https://fly.storage.tigris.dev',
        defaultRegion: 'auto',
    },
    'aws-s3': {
        name: 'AWS S3',
        defaultRegion: 'us-east-1',
    },
    'minio': {
        name: 'MinIO',
        defaultRegion: 'us-east-1',
    },
    'custom': {
        name: '自定义 S3',
        defaultRegion: 'us-east-1',
    },
};

export const buildS3Endpoint = (preset: string, accountId?: string, region?: string): string => {
    switch (preset) {
        case 'cloudflare-r2':
            return accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '';
        case 'tigris':
            return 'https://fly.storage.tigris.dev';
        case 'aws-s3':
            return region ? `https://s3.${region}.amazonaws.com` : '';
        default:
            return '';
    }
};
