'use client';

import { getUserSessionsList, revokeSession } from '@/lib/user-actions';
import SessionManager from '@/components/SessionManager';

export default function SessionsList() {
    return (
        <SessionManager
            isAdmin={false}
            fetchSessions={async () => {
                const result = await getUserSessionsList();
                return {
                    sessions: result.sessions as any,
                    error: result.error
                };
            }}
            onRevoke={async (id) => {
                const result = await revokeSession(id);
                return {
                    success: !!result.success,
                    error: result.error
                };
            }}
        />
    );
}
