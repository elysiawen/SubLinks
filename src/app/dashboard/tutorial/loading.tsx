export default function TutorialLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Skeleton */}
                <div className="mb-8 text-center animate-pulse">
                    <div className="mx-auto w-16 h-16 bg-gray-200 rounded-2xl mb-4"></div>
                    <div className="h-10 w-64 bg-gray-200 rounded mx-auto mb-3"></div>
                    <div className="h-6 w-96 bg-gray-100 rounded mx-auto"></div>
                </div>

                {/* Navigation Tabs Skeleton */}
                <div className="lg:sticky top-0 z-30 mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-4 backdrop-blur-md">
                    <div className="max-w-7xl mx-auto animate-pulse">
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2">
                            <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="h-10 flex-1 min-w-[140px] bg-gray-100 rounded-xl"></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area Skeleton */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 lg:p-12 animate-pulse">
                    {/* Mocking the Client Downloads view since it's default */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Sidebar/OS Tabs Skeleton */}
                        <div className="lg:col-span-1 space-y-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-12 w-full bg-gray-100 rounded-xl"></div>
                            ))}
                        </div>

                        {/* Main Content Skeleton */}
                        <div className="lg:col-span-3 space-y-6">
                            <div className="h-8 w-48 bg-gray-200 rounded"></div>

                            <div className="bg-gray-50 border-l-4 border-gray-200 p-6 rounded-r-xl">
                                <div className="flex items-start gap-4">
                                    <div className="h-12 w-12 bg-gray-200 rounded"></div>
                                    <div className="flex-1 space-y-3">
                                        <div className="h-6 w-32 bg-gray-200 rounded"></div>
                                        <div className="h-4 w-full bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="h-32 bg-gray-50 rounded-xl border border-gray-100"></div>
                                <div className="h-32 bg-gray-50 rounded-xl border border-gray-100"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
