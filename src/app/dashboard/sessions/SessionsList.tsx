'use client';

import { getUserSessionsList, revokeSession } from '@/lib/user-actions';
import SessionManager from '@/components/SessionManager';

export default function SessionsList() {
    return (
        <SessionManager
            isAdmin={false}
            fetchSessions={async (search) => {
                const result = await getUserSessionsList(search);
                return {
                    sessions: result.sessions as any,
                    error: result.error
                };
            }}
            onRevoke={async (id, type) => {
                const result = await revokeSession(id, type);
                return {
                    success: !!result.success,
                    revoked: !!result.revoked,
                    message: result.message,
                    error: result.error
                };
            }}
        />
    );
}
