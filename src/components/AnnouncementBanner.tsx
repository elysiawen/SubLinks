'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { X } from 'lucide-react';

export default function AnnouncementBanner({ content, className = '' }: { content?: string; className?: string }) {
    if (!content) return null;

    return (
        <div className={`relative animate-in fade-in slide-in-from-top-4 duration-500 ${className}`}>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 shadow-sm h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-100/50">
                    <span className="text-xl">📢</span>
                    <span className="font-semibold text-blue-900">公告栏</span>
                </div>
                <div className="prose prose-sm max-w-none prose-blue prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 text-gray-700 w-full pr-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {content}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}
