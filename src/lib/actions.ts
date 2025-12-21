'use server'

import { redis } from '@/lib/redis';
import { createSession, verifyPassword, hashPassword } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'auth_session';

export async function login(prevState: any, formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) return { error: '请输入用户名和密码' };

    // 1. Check for Admin Init (First Run)
    const adminExists = await redis.exists('user:admin');
    if (!adminExists) {
        // Create default admin
        if (username === 'admin' && password === 'admin') {
            const hashedPassword = await hashPassword('admin');
            await redis.set('user:admin', JSON.stringify({
                password: hashedPassword,
                role: 'admin',
                status: 'active',
                createdAt: Date.now()
            }));
            await redis.sadd('users:index', 'admin');
        } else {
            return { error: '系统初始化中，请使用默认账号 admin/admin 登录' };
        }
    }

    // 2. Verify User
    const userStr = await redis.get(`user:${username}`);
    if (!userStr) {
        return { error: '用户不存在' };
    }

    const user = JSON.parse(userStr);

    // Check status
    if (user.status !== 'active') {
        return { error: '账户已被停用' };
    }

    // Check password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
        return { error: '密码错误' };
    }

    // 3. Create Session
    const sessionId = await createSession(username, user.role);

    // 4. Set Cookie
    (await cookies()).set(COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // 5. Redirect based on role
    if (user.role === 'admin') {
        redirect('/admin');
    } else {
        redirect('/dashboard');
    }
}

export async function logout() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(COOKIE_NAME)?.value;
    if (sessionId) {
        await redis.del(`session:${sessionId}`);
    }
    cookieStore.delete(COOKIE_NAME);
    redirect('/login');
}
