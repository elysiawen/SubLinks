'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from './sidebar';

export default function AdminShell({
    children,
    username
}: {
    children: React.ReactNode;
    username: string;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar on navigation
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    return (
        <div className="h-screen bg-gray-50 flex font-sans overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden md:flex flex-col w-64 fixed inset-y-0 z-50">
                <AdminSidebar username={username} />
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                        onClick={() => setSidebarOpen(false)}
                    />

                    {/* Drawer */}
                    <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-2xl flex flex-col animate-slide-in-left">
                        <AdminSidebar username={username} />
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all active:scale-95"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col md:pl-64 h-full">
                {/* Mobile Header */}
                <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-gray-200 p-4 flex items-center justify-start gap-4 shadow-sm sticky top-0 z-30 transition-all">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-transform active:scale-95"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span className="font-bold text-gray-800 text-lg tracking-tight">SubLink Admin</span>
                </div>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto w-full">
                    <div key={pathname} className="p-4 md:p-8 max-w-6xl mx-auto animate-slide-in-up">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
