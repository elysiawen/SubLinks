'use client';

import { getAllSessionsList, revokeAnySession } from '@/lib/admin-actions';
import SessionManager from '@/components/SessionManager';

export default function AdminSessionsList() {
    return (
        <SessionManager
            isAdmin={true}
            fetchSessions={async (search) => {
                const result = await getAllSessionsList(1, 100, search);
                return {
                    sessions: result.sessions as any,
                    total: result.total
                };
            }}
            onRevoke={async (id, type) => {
                const result = await revokeAnySession(id, type);
                return {
                    success: !!result.success
                };
            }}
        />
    );
}
