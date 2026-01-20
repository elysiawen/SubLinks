export default function SessionsLoading() {
    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-100 dark:border-zinc-800 pb-6">
                <div className="space-y-3">
                    <div className="h-3 w-32 bg-blue-100/50 dark:bg-blue-900/20 rounded-full"></div>
                    <div className="h-8 w-48 bg-gray-200 dark:bg-zinc-800 rounded-lg"></div>
                    <div className="h-4 w-64 bg-gray-100 dark:bg-zinc-900 rounded-md"></div>
                </div>
            </div>

            {/* List Skeleton */}
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex flex-col sm:flex-row items-center justify-between p-5 bg-white dark:bg-zinc-900/40 rounded-3xl border border-gray-100 dark:border-zinc-800 gap-5">
                        <div className="flex items-center gap-5 w-full">
                            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex-shrink-0"></div>
                            <div className="flex-1 space-y-3">
                                <div className="flex gap-2">
                                    <div className="h-5 w-32 bg-gray-200 dark:bg-zinc-800 rounded-md"></div>
                                    <div className="h-5 w-16 bg-gray-100 dark:bg-zinc-800 rounded-full"></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-3 w-48 bg-gray-100 dark:bg-zinc-900 rounded"></div>
                                    <div className="h-3 w-32 bg-gray-50 dark:bg-zinc-900/50 rounded"></div>
                                </div>
                            </div>
                        </div>
                        <div className="w-full sm:w-24 h-10 bg-gray-100 dark:bg-zinc-800 rounded-2xl"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}
