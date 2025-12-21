import { getGlobalConfig } from '../actions';
import AdminSettingsClient from './client';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
    const config = await getGlobalConfig();
    return <AdminSettingsClient config={config} />;
}
