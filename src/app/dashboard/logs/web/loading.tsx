export default function WebLogsLoading() {
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">访问日志</h1>
                    <p className="text-sm text-gray-500 mt-1">查看您的网站访问历史记录</p>
                </div>
            </div>

            {/* Logs List - Mobile/Desktop Responsive */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Table Header (Desktop) */}
                <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200">
                    <div className="col-span-2 h-4 bg-gray-200 rounded"></div>
                    <div className="col-span-2 h-4 bg-gray-200 rounded"></div>
                    <div className="col-span-5 h-4 bg-gray-200 rounded"></div>
                    <div className="col-span-1 h-4 bg-gray-200 rounded"></div>
                    <div className="col-span-2 h-4 bg-gray-200 rounded"></div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-gray-100">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="p-4 animate-pulse">
                            <div className="flex flex-col md:grid md:grid-cols-12 md:gap-4 space-y-2 md:space-y-0">
                                <div className="md:col-span-2 h-5 bg-gray-100 rounded w-24"></div>
                                <div className="md:col-span-2 h-5 bg-gray-100 rounded w-20"></div>
                                <div className="md:col-span-5 h-5 bg-gray-100 rounded w-3/4"></div>
                                <div className="md:col-span-1 h-5 bg-gray-100 rounded w-16"></div>
                                <div className="md:col-span-2 h-5 bg-gray-100 rounded w-20"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pagination */}
            <div className="flex justify-center pt-4 gap-2 animate-pulse">
                <div className="h-8 w-8 bg-gray-100 rounded"></div>
                <div className="h-8 w-8 bg-gray-200 rounded"></div>
                <div className="h-8 w-8 bg-gray-100 rounded"></div>
            </div>
        </div>
    );
}
