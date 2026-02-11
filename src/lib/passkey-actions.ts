'use server';

import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { db } from '@/lib/db';
import { getCurrentSession } from '@/lib/user-actions';
import { PasskeyCredentials, PasskeyProfile } from '@/lib/database/interface';
import { headers, cookies } from 'next/headers';
import { randomUUID } from 'crypto';

// --- Registration ---

import { getAuthenticatorInfo } from './aaguids';

export async function getPasskeys(): Promise<PasskeyProfile[]> {
    const session = await getCurrentSession(); // Changed from getSession() to getCurrentSession() to match existing pattern
    if (!session || !session.username) { // Changed from session.user to session.username to match getCurrentSession() return type
        throw new Error('Unauthorized');
    }

    const user = await db.getUser(session.username); // Get user to retrieve ID
    if (!user) {
        throw new Error('User not found');
    }

    const passkeys = await db.getUserPasskeys(user.id);

    // Enrich with provider info on the server side
    return passkeys.map(pk => {
        const info = getAuthenticatorInfo(pk.aaguid);
        return {
            ...pk,
            providerName: info.name,
            providerIcon: info.icon
        };
    });
}
export async function generatePasskeyRegistrationOptions() {
    const session = await getCurrentSession();
    if (!session) {
        return { error: 'Unauthorized' };
    }

    const user = await db.getUser(session.username);
    if (!user) {
        return { error: 'User not found' };
    }

    const userPasskeys = await db.getUserPasskeys(user.id);
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost';
    const rpID = host.split(':')[0];

    const options = await generateRegistrationOptions({
        rpName: 'SubLinks',
        rpID,
        userID: new TextEncoder().encode(user.id),
        userName: user.username,
        userDisplayName: user.nickname || user.username,
        attestationType: 'none',
        authenticatorSelection: {
            residentKey: 'required', // Required for usernameless
            userVerification: 'preferred',
            authenticatorAttachment: 'cross-platform',
        },
        excludeCredentials: userPasskeys.map(passkey => ({
            id: passkey.id,
            transports: passkey.transports as AuthenticatorTransport[],
        })),
    });

    await db.setCache(`passkey:register:${user.id}`, options.challenge, 300);

    return { options };
}

export async function verifyPasskeyRegistration(response: any, credentialName: string) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: 'Unauthorized' };
    }

    const user = await db.getUser(session.username);
    if (!user) {
        return { error: 'User not found' };
    }

    const expectedChallenge = await db.getCache(`passkey:register:${user.id}`);
    if (!expectedChallenge) {
        return { error: 'Challenge expired or not found' };
    }

    const headersList = await headers();
    const host = headersList.get('host') || 'localhost';
    const origin = headersList.get('origin') || `https://${host}`;
    const rpID = host.split(':')[0];

    try {
        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: true,
        });

        if (verification.verified && verification.registrationInfo) {
            const { credential } = verification.registrationInfo;
            const { id: credentialID, publicKey: credentialPublicKey, counter, transports } = credential;
            // Extract AAGUID from authenticatorData
            // authenticatorData is a buffer, AAGUID is 16 bytes starting at index 37
            // However, simplewebauthn might not expose raw authData easily in this object structure if it's already parsed.
            // verification.registrationInfo.authenticator.aaguid is available in newer versions or check interface

            // Check what is available in registrationInfo
            const aaguid = verification.registrationInfo.aaguid;

            const newPasskey: PasskeyCredentials = {
                id: credentialID,
                userId: user.id,
                publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
                counter: Number(counter),
                transports: (transports as string[]) || [],
                name: credentialName || 'Passkey',
                aaguid: aaguid,
                createdAt: Date.now(),
                lastUsed: Date.now()
            };

            await db.addPasskey(newPasskey);
            await db.deleteCache(`passkey:register:${user.id}`);

            return { success: true };
        } else {
            return { error: 'Verification failed' };
        }
    } catch (error: any) {
        console.error('Passkey verification error:', error);
        return { error: error.message };
    }
}

// --- Login ---

export async function generatePasskeyLoginOptions(username?: string) {
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost';
    const rpID = host.split(':')[0];

    // Explicitly type as what simplewebauthn expects, or let inference work.
    // simplewebauthn expects { id: string, transports?: ... }[]
    let allowCredentials: { id: string; transports?: AuthenticatorTransport[]; type: 'public-key' }[] | undefined;
    let userIdForCache: string | null = null;

    if (username) {
        const user = await db.getUser(username);
        if (user) {
            const userPasskeys = await db.getUserPasskeys(user.id);
            allowCredentials = userPasskeys.map(passkey => ({
                id: passkey.id,
                transports: passkey.transports as AuthenticatorTransport[],
                type: 'public-key',
            }));
            userIdForCache = user.id;
        }
    }

    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials,
        userVerification: 'preferred',
    });

    // Use a flowId to track the challenge, since we might not have a userId
    const flowId = randomUUID();
    await db.setCache(`passkey:login:flow:${flowId}`, options.challenge, 300);

    return { options, flowId };
}

export async function verifyPasskeyLogin(response: any, flowId: string) {
    if (!response || !flowId) {
        return { error: 'Missing parameters' };
    }

    const expectedChallenge = await db.getCache(`passkey:login:flow:${flowId}`);
    if (!expectedChallenge) {
        return { error: 'Challenge expired or not found' };
    }

    // Lookup passkey by credential ID
    const passkeyId = response.id;
    const passkey = await db.getPasskey(passkeyId);

    if (!passkey) {
        return { error: 'Passkey not found' };
    }

    const user = await db.getUserById(passkey.userId);
    if (!user) {
        return { error: 'User not found' };
    }

    const headersList = await headers();
    const host = headersList.get('host') || 'localhost';
    const origin = headersList.get('origin') || `https://${host}`;
    const rpID = host.split(':')[0];

    try {
        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
                publicKey: Buffer.from(passkey.publicKey, 'base64url'),
                id: passkey.id,
                counter: passkey.counter,
                transports: passkey.transports as AuthenticatorTransport[],
            },
            requireUserVerification: true,
        });

        if (verification.verified) {
            const { authenticationInfo } = verification;
            const newCounter = authenticationInfo.newCounter;

            await db.updatePasskeyCounter(passkey.id, newCounter);
            await db.deleteCache(`passkey:login:flow:${flowId}`);

            // Create Session
            const sessionId = randomUUID();
            const ip = headersList.get('x-forwarded-for') || 'unknown';
            const ua = headersList.get('user-agent') || 'unknown';

            await db.createSession(sessionId, {
                userId: user.id,
                username: user.username,
                role: user.role,
                tokenVersion: user.tokenVersion || 0,
                nickname: user.nickname,
                avatar: user.avatar,
                ip,
                ua,
                deviceInfo: ua, // Use UA for parsing
                lastActive: Date.now(),
                loginMethod: 'passkey'
            }, 7 * 24 * 60 * 60);

            const cookieStore = await cookies();
            cookieStore.set('auth_session', sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 7 * 24 * 60 * 60
            });

            return { success: true };
        } else {
            return { error: 'Verification failed' };
        }
    } catch (error: any) {
        console.error('Passkey authentication error:', error);
        return { error: error.message };
    }
}



export async function deletePasskey(passkeyId: string) {
    const session = await getCurrentSession();
    if (!session) {
        return { error: 'Unauthorized' };
    }
    await db.deletePasskey(passkeyId, session.userId);
    return { success: true };
}
