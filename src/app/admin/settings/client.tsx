'use client';

export default function AdminSettingsClient({ config }: { config: any }) {
    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">全局设置</h2>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="max-w-md mx-auto space-y-4">
                    <div className="text-6xl mb-4">⚙️</div>
                    <h3 className="text-xl font-semibold text-gray-800">全局设置</h3>
                    <p className="text-gray-500">
                        系统配置功能正在开发中...
                    </p>
                    <div className="pt-4">
                        <a
                            href="/admin/sources"
                            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            📡 前往上游源管理
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
