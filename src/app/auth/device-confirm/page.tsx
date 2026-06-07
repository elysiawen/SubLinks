import { Suspense } from 'react';
import DeviceConfirmClient from './client';

export default async function DeviceConfirmPage({
    searchParams,
}: {
    searchParams: Promise<{ code?: string }>;
}) {
    const { code } = await searchParams;

    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-button"></div>
                </div>
            }
        >
            <DeviceConfirmClient deviceCode={code || ''} />
        </Suspense>
    );
}
