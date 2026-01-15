'use server';

import { db } from '@/lib/db';
import { getSession, verifyPassword, hashPassword } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

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
        password: hashedPassword,
        tokenVersion: (user.tokenVersion || 0) + 1  // Increment to invalidate all tokens
    });

    // Logout user by deleting current session
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (sessionId) {
        await db.deleteSession(sessionId);
        cookieStore.delete('auth_session');
    }

    return { success: true };
}

export async function deleteOwnAccount(password: string) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: '未登录' };
    }

    if (session.role === 'admin') {
        return { error: '管理员账号无法通过此方式删除，请联系技术支持' };
        // Protecting admin account from accidental self-deletion
    }

    // Get user
    const user = await db.getUser(session.username);
    if (!user) {
        return { error: '用户不存在' };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
        return { error: '密码错误，验证失败' };
    }

    // Delete user
    await db.deleteUser(session.username);

    // Delete session (Logout)
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;
    if (sessionId) {
        await db.deleteSession(sessionId);
        cookieStore.delete('auth_session');
    }

    return { success: true };
}
