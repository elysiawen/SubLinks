export default function RulesLoading() {
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">自定义规则</h1>
                    <p className="text-sm text-gray-500 mt-1">管理您的分流规则配置</p>
                </div>
                <div className="h-10 w-28 bg-blue-100 rounded-lg opacity-50 animate-pulse"></div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 animate-pulse">
                <div className="h-10 w-full md:w-64 bg-gray-100 rounded-lg"></div>
            </div>

            {/* Rules Grid (Advanced/Simple Mode Switch) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm animate-pulse">
                        <div className="flex justify-between items-start mb-4">
                            <div className="space-y-2 flex-1">
                                <div className="h-6 w-1/2 bg-gray-200 rounded"></div>
                                <div className="h-3 w-1/3 bg-gray-100 rounded"></div>
                            </div>
                        </div>

                        {/* Rule Content Preview */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-4 h-32 w-full"></div>

                        <div className="flex gap-2 border-t border-gray-100 pt-4">
                            <div className="flex-1 h-9 bg-gray-100 rounded-lg"></div>
                            <div className="flex-1 h-9 bg-gray-100 rounded-lg"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
