export default function SettingsLoading() {
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-10">
            {/* Header */}
            <div>
                <div className="h-8 w-32 bg-muted rounded animate-pulse"></div>
                <div className="h-4 w-64 bg-muted rounded mt-2 animate-pulse"></div>
            </div>

            {/* Profile Section Skeleton */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden animate-pulse">
                <div className="p-6 border-b border-border">
                    <div className="h-6 w-24 bg-muted rounded"></div>
                    <div className="h-4 w-48 bg-muted rounded mt-2"></div>
                </div>
                <div className="p-6 space-y-4 max-w-lg">
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-muted rounded-full"></div>
                        <div className="h-10 w-28 bg-muted rounded-lg"></div>
                    </div>
                    {[1, 2].map(i => (
                        <div key={i}>
                            <div className="h-4 w-20 bg-muted rounded mb-2"></div>
                            <div className="h-10 w-full bg-muted rounded-lg border border-border"></div>
                        </div>
                    ))}
                    <div className="pt-2">
                        <div className="h-10 w-28 bg-muted rounded-lg"></div>
                    </div>
                </div>
            </div>

            {/* 2FA Section Skeleton */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden animate-pulse">
                <div className="p-6 border-b border-border">
                    <div className="h-6 w-40 bg-muted rounded"></div>
                    <div className="h-4 w-56 bg-muted rounded mt-2"></div>
                </div>
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-2">
                            <div className="h-5 w-32 bg-muted rounded"></div>
                            <div className="h-4 w-64 bg-muted rounded"></div>
                        </div>
                        <div className="h-10 w-24 bg-muted rounded-lg"></div>
                    </div>
                </div>
            </div>

            {/* Passkey Section Skeleton */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden animate-pulse">
                <div className="p-6 border-b border-border">
                    <div className="h-6 w-36 bg-muted rounded"></div>
                    <div className="h-4 w-52 bg-muted rounded mt-2"></div>
                </div>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="h-6 w-28 bg-muted rounded"></div>
                        <div className="h-10 w-24 bg-muted rounded-lg"></div>
                    </div>
                    <div className="h-16 w-full bg-muted rounded-xl border border-border"></div>
                </div>
            </div>

            {/* Change Password Skeleton */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden animate-pulse">
                <div className="p-6 border-b border-border">
                    <div className="h-6 w-32 bg-muted rounded"></div>
                    <div className="h-4 w-64 bg-muted rounded mt-2"></div>
                </div>
                <div className="p-6 space-y-4 max-w-lg">
                    {[1, 2, 3].map(i => (
                        <div key={i}>
                            <div className="h-4 w-20 bg-muted rounded mb-2"></div>
                            <div className="h-10 w-full bg-muted rounded-lg border border-border"></div>
                        </div>
                    ))}
                    <div className="pt-2">
                        <div className="h-10 w-28 bg-muted rounded-lg"></div>
                    </div>
                </div>
            </div>

            {/* Danger Zone Skeleton */}
            <div className="bg-card rounded-xl shadow-sm border border-red-100 dark:border-red-900/50 overflow-hidden animate-pulse">
                <div className="p-6 border-b border-red-50 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/30">
                    <div className="h-6 w-32 bg-red-100 dark:bg-red-900/40 rounded"></div>
                    <div className="h-4 w-48 bg-red-50 dark:bg-red-900/30 rounded mt-2"></div>
                </div>
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-2">
                            <div className="h-5 w-24 bg-muted rounded"></div>
                            <div className="h-4 w-64 bg-muted rounded"></div>
                        </div>
                        <div className="h-10 w-24 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-100 dark:border-red-900/50"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
