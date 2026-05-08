import { getTranslations } from 'next-intl/server';
import LogsClient from './client';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
    const t = await getTranslations('admin.logs');
    return {
        title: t('pageTitle'),
    };
}

export default async function LogsPage() {
    const t = await getTranslations('admin.logs');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary mb-2">{t('pageTitle')}</h1>
                    <p className="text-text-secondary">{t('pageDesc')}</p>
                </div>
            </div>

            <LogsClient />
        </div>
    );
}
