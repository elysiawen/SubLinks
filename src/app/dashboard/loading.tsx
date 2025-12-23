export default function DashboardLoading() {
    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header - High Fidelity with Spinner */}
                <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-pulse">
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">用户中心</h1>
                    <div className="flex items-center gap-4">
                        {/* Username Placeholder */}
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin"></div>
                            <span className="font-medium text-gray-400 text-sm">加载中...</span>
                        </div>

                        {/* Disabled Buttons Skeletons */}
                        <div className="h-8 w-20 bg-gray-100 rounded-full border border-gray-200"></div>
                        <div className="h-8 w-16 bg-gray-100 rounded-full border border-gray-200"></div>
                    </div>
                </header>

                <div className="flex justify-between items-center px-1">
                    <h2 className="text-xl font-semibold text-gray-700">我的订阅</h2>
                    <div className="h-10 w-28 bg-blue-100 rounded-xl opacity-50"></div>
                </div>

                <div className="grid gap-5 grid-cols-1">
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-2">
                                    <div className="h-6 bg-gray-200 rounded w-48"></div>
                                    <div className="h-4 bg-gray-100 rounded w-64"></div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="h-4 bg-gray-200 rounded w-8"></div>
                                    <div className="h-4 bg-gray-200 rounded w-8"></div>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 h-10 mb-4"></div>
                            <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
