export default function AdminLoading() {
    return (
        <div className="space-y-6">
            {/* Page Header Skeleton */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="h-8 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded w-48"></div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-border-input border-t-accent rounded-full animate-spin"></div>
                        <span className="text-xs text-text-tertiary font-medium">数据加载中...</span>
                    </div>
                </div>
                <div className="h-10 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded-lg w-32"></div>
            </div>

            {/* Toolbar/Search Skeleton */}
            <div className="flex gap-4 mb-6">
                <div className="h-10 bg-gradient-to-r from-card via-muted to-card bg-[length:200%_100%] animate-shimmer border border-border-strong rounded-lg w-64 shadow-sm"></div>
                <div className="h-10 bg-gradient-to-r from-card via-muted to-card bg-[length:200%_100%] animate-shimmer border border-border-strong rounded-lg w-32 shadow-sm"></div>
            </div>

            {/* Table/Content Skeleton */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                {/* Table Header */}
                <div className="border-b border-border bg-surface p-4 grid grid-cols-4 gap-4">
                    <div className="h-4 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded w-24"></div>
                    <div className="h-4 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded w-32"></div>
                    <div className="h-4 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded w-20"></div>
                    <div className="h-4 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded w-16"></div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-border">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div key={i} className="p-4 grid grid-cols-4 gap-4 items-center hover:bg-muted/50 transition-colors">
                            <div className="h-4 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded w-3/4" style={{ animationDelay: `${i * 0.1}s` }}></div>
                            <div className="h-4 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded w-1/2" style={{ animationDelay: `${i * 0.1}s` }}></div>
                            <div className="h-6 bg-gradient-to-r from-muted via-card to-muted bg-[length:200%_100%] animate-shimmer rounded-full w-16 border border-border" style={{ animationDelay: `${i * 0.1}s` }}></div>
                            <div className="h-8 bg-gradient-to-r from-muted via-card to-muted bg-[length:200%_100%] animate-shimmer rounded w-20 border border-border" style={{ animationDelay: `${i * 0.1}s` }}></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Stats Cards Skeleton (if applicable) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-card rounded-xl shadow-sm border border-border p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="h-4 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded w-24" style={{ animationDelay: `${i * 0.15}s` }}></div>
                            <div className="h-8 w-8 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded-lg" style={{ animationDelay: `${i * 0.15}s` }}></div>
                        </div>
                        <div className="h-8 bg-gradient-to-r from-border-strong via-muted to-border-strong bg-[length:200%_100%] animate-shimmer rounded w-32 mb-2" style={{ animationDelay: `${i * 0.15}s` }}></div>
                        <div className="h-3 bg-gradient-to-r from-muted via-card to-muted bg-[length:200%_100%] animate-shimmer rounded w-20" style={{ animationDelay: `${i * 0.15}s` }}></div>
                    </div>
                ))}
            </div>
        </div>
    );
}
