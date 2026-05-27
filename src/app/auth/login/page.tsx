import { db } from '@/lib/db';
import LoginContent from './client';

export default async function LoginPage() {
    const providers = (await db.getOAuthProviders()).filter(p => p.enabled);

    return <LoginContent oauthProviders={providers} />;
}
