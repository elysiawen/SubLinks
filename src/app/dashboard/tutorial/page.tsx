import TutorialClient from './client';

export const dynamic = 'force-dynamic';

export default async function TutorialPage() {
    // Artificial delay to show loading skeleton
    await new Promise((resolve) => setTimeout(resolve, 1));
    return <TutorialClient />;
}
