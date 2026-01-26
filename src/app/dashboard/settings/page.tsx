import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SettingsClient from './client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (!sessionId) {
        redirect('/login');
    }

    const user = await getSession(sessionId);
    if (!user) {
        redirect('/login');
    }

    // 从数据库获取最新的用户信息以包含 2FA 状态
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
