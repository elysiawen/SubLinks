export default function DashboardLoading() {
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Welcome Banner Skeleton */}
            <div className="relative rounded-2xl p-8 bg-gray-200 animate-pulse h-40 overflow-hidden">
                <div className="relative z-10 space-y-3">
                    <h1 className="text-3xl font-bold bg-gray-300 text-transparent bg-clip-text w-fit rounded">
                        欢迎回来
                    </h1>
                    <div className="h-4 w-48 bg-gray-300 rounded"></div>
                </div>
            </div>

            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse h-40 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="h-5 w-20 bg-gray-100 rounded"></div>
                            <div className="h-8 w-8 bg-gray-100 rounded-lg"></div>
                        </div>
                        <div className="flex items-end justify-between">
                            <div className="space-y-2">
                                <div className="h-10 w-16 bg-gray-200 rounded"></div>
                                <div className="h-3 w-12 bg-gray-50 rounded"></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Upstream Sources Skeleton */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">上游源信息</h2>
                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="border border-gray-100 rounded-lg p-4 h-32">
                            <div className="flex justify-between mb-4">
                                <div className="h-5 w-32 bg-gray-100 rounded"></div>
                                <div className="h-5 w-16 bg-gray-100 rounded"></div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 w-full bg-gray-50 rounded"></div>
                                <div className="h-2 w-full bg-gray-100 rounded-full mt-2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Access Logs Skeleton */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
                <div className="flex justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-800">访问日志</h2>
                    <div className="h-4 w-16 bg-gray-100 rounded"></div>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex flex-col md:flex-row justify-between p-3 border border-gray-50 rounded-lg h-16">
                            <div className="space-y-2 w-full md:w-1/2">
                                <div className="h-4 w-32 bg-gray-100 rounded"></div>
                                <div className="h-3 w-48 bg-gray-50 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
