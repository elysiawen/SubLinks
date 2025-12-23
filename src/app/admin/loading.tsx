export default function AdminLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Page Header Skeleton */}
            <div className="flex justify-between items-center mb-6">
                <div className="h-8 bg-gray-200 rounded w-48"></div>
                <div className="h-10 bg-gray-200 rounded-lg w-32"></div>
            </div>

            {/* Toolbar/Search Skeleton */}
            <div className="flex gap-4 mb-6">
                <div className="h-10 bg-white border border-gray-100 rounded-lg w-64"></div>
                <div className="h-10 bg-white border border-gray-100 rounded-lg w-32"></div>
            </div>

            {/* Table/Content Skeleton */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Table Header */}
                <div className="border-b border-gray-100 bg-gray-50/50 p-4 grid grid-cols-4 gap-4">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-gray-50">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-4 grid grid-cols-4 gap-4 items-center">
                            <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                            <div className="h-6 bg-gray-50 rounded-full w-16 border border-gray-100"></div>
                            <div className="h-8 bg-gray-50 rounded w-20 border border-gray-100"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
