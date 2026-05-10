import { requireSession } from '@/lib/require-session';
import SettingsClient from './client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const user = await requireSession();
    if (!user) return null;

    const { db } = await import('@/lib/db');
    const dbUser = await db.getUser(user.username);
    const totpEnabled = dbUser?.totpEnabled || false;

    return <SettingsClient
        username={user.username}
        role={user.role}
        nickname={user.nickname}
        avatar={user.avatar}
        totpEnabled={totpEnabled}
    />;
}
