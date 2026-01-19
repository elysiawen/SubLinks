import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function generateToken(length = 16) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let token = '';
    for (let i = 0; i < length; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
}

export const BLOCKED_UAS = ['MicroMessenger', 'QQ/'];

/**
 * Convert relative avatar path to full URL
 * @param avatar - Avatar path (can be relative or absolute URL)
 * @param baseUrl - Base URL of the application
 * @returns Full avatar URL
 */
export function getFullAvatarUrl(avatar: string | null | undefined, baseUrl?: string): string | undefined {
    if (!avatar) return undefined;

    // If already an absolute URL (http:// or https://), return as is
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
        return avatar;
    }

    // Get base URL from environment or use default
    const base = baseUrl || process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    // Ensure avatar path starts with /
    const path = avatar.startsWith('/') ? avatar : `/${avatar}`;

    // Combine base URL and path
    return `${base}${path}`;
}
