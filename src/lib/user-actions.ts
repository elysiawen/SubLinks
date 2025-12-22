'use server';

import { db } from '@/lib/db';
import { getSession, verifyPassword, hashPassword } from '@/lib/auth';
import { cookies } from 'next/headers';

async function getCurrentSession() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (!sessionId) return null;
    return await getSession(sessionId);
}

export async function changePassword(oldPassword: string, newPassword: string) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: '未登录' };
    }

    // Get user
    const user = await db.getUser(session.username);
    if (!user) {
        return { error: '用户不存在' };
    }

    // Verify old password
    const isValid = await verifyPassword(oldPassword, user.password);
    if (!isValid) {
        return { error: '原密码错误' };
    }

    // Validate new password
    if (!newPassword || newPassword.length < 4) {
        return { error: '新密码至少需要4个字符' };
    }

    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);
    await db.setUser(session.username, {
        ...user,
        password: hashedPassword
    });

    return { success: true };
}
