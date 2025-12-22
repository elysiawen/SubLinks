import LogsClient from './client';

export const metadata = {
    title: '系统日志 - Admin Dashboard',
};

export default function LogsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">系统日志</h1>
                    <p className="text-gray-600">查看API访问、网站访问及系统运行日志</p>
                </div>
            </div>

            <LogsClient />
        </div>
    );
}
