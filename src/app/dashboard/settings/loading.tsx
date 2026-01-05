export default function SettingsLoading() {
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-10">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800">账户设置</h1>
                <p className="text-sm text-gray-500 mt-1">管理您的个人资料和安全设置</p>
            </div>

            {/* Change Password Skeleton */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
                <div className="p-6 border-b border-gray-100">
                    <div className="h-6 w-32 bg-gray-200 rounded"></div>
                    <div className="h-4 w-64 bg-gray-100 rounded mt-2"></div>
                </div>
                <div className="p-6 space-y-4 max-w-lg">
                    {[1, 2, 3].map(i => (
                        <div key={i}>
                            <div className="h-4 w-20 bg-gray-100 rounded mb-2"></div>
                            <div className="h-10 w-full bg-gray-50 rounded-lg border border-gray-100"></div>
                        </div>
                    ))}
                    <div className="pt-2">
                        <div className="h-10 w-28 bg-gray-200 rounded-lg"></div>
                    </div>
                </div>
            </div>

            {/* Danger Zone Skeleton */}
            <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden animate-pulse">
                <div className="p-6 border-b border-red-50 bg-red-50/30">
                    <div className="h-6 w-32 bg-red-100 rounded"></div>
                    <div className="h-4 w-48 bg-red-50 rounded mt-2"></div>
                </div>
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-2">
                            <div className="h-5 w-24 bg-gray-200 rounded"></div>
                            <div className="h-4 w-64 bg-gray-100 rounded"></div>
                        </div>
                        <div className="h-10 w-24 bg-red-50 rounded-lg border border-red-100"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
