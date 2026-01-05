export default function SubscriptionsLoading() {
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">我的订阅</h2>
                    <div className="h-4 w-48 bg-gray-100 rounded mt-2"></div>
                </div>
                <div className="h-10 w-28 bg-blue-100 rounded-lg opacity-50 animate-pulse"></div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 animate-pulse flex gap-4">
                <div className="h-10 w-64 bg-gray-100 rounded-lg flex-1"></div>
                <div className="h-10 w-32 bg-gray-100 rounded-lg"></div>
                <div className="h-10 w-32 bg-gray-100 rounded-lg"></div>
            </div>

            {/* Subscriptions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm animate-pulse">
                        <div className="flex justify-between items-start mb-4">
                            <div className="space-y-2 flex-1">
                                <div className="h-6 w-3/4 bg-gray-200 rounded"></div>
                                <div className="h-4 w-1/2 bg-gray-100 rounded"></div>
                            </div>
                            <div className="h-8 w-16 bg-gray-100 rounded-lg ml-4"></div>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="h-8 bg-gray-50 rounded-lg w-full"></div>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
                            <div className="flex gap-2">
                                <div className="h-4 w-12 bg-gray-100 rounded"></div>
                                <div className="h-4 w-12 bg-gray-100 rounded"></div>
                            </div>
                            <div className="h-8 w-20 bg-gray-100 rounded-lg"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
