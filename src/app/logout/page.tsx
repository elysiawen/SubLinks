import { clearSession } from '@/lib/actions';
import LogoutUI from './logout-ui';

export default async function LogoutPage() {
    await clearSession();
    return <LogoutUI />;
}
