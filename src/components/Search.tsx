'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';

export default function Search({ placeholder }: { placeholder: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [text, setText] = useState(searchParams.get('search') || '');
    const [query] = useDebounce(text, 300);

    useEffect(() => {
        const currentSearch = searchParams.get('search') || '';
        if (query === currentSearch) return;

        const params = new URLSearchParams(searchParams);
        if (query) {
            params.set('search', query);
        } else {
            params.delete('search');
        }
        params.set('page', '1'); // Reset to page 1 on search

        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
        });
    }, [query, pathname, router, searchParams]);

    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
            </div>
            <input
                type="text"
                className="block w-full pl-10 pr-10 py-2.5 sm:py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm sm:text-sm shadow-sm transition-colors"
                placeholder={placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
            />
            {isPending && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            )}
        </div>
    );
}
