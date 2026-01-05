'use client';


import { useEffect, useState } from 'react';

interface Hitokoto {
    id: number;
    hitokoto: string;
    type: string;
    from: string;
    from_who: string | null;
    creator: string;
    creator_uid: number;
    reviewer: number;
    uuid: string;
    commit_from: string;
    created_at: string;
    length: number;
}

export default function HitokotoClient({ customBg }: { customBg?: string }) {
    const [quote, setQuote] = useState<Hitokoto | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('https://v1.hitokoto.cn/')
            .then(res => res.json())
            .then(data => {
                setQuote(data);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);

    return (
        <main
            className="flex min-h-screen flex-col p-6 relative overflow-hidden"
            style={customBg ? {
                backgroundImage: `url(${customBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            } : {}}
        >
            {/* Default gradient background - only show if no custom background */}
            {!customBg && (
                <>
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900"></div>
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] animate-pulse pointer-events-none"></div>
                        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-cyan-500/20 rounded-full blur-[128px] animate-pulse pointer-events-none" style={{ animationDelay: '1s' }}></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[128px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>
                    </div>
                </>
            )}

            {/* Dark overlay for custom backgrounds to ensure text readability */}
            {customBg && (
                <div className="absolute inset-0 bg-black/50"></div>
            )}

            {/* Content - centered */}
            <div className="flex-1 flex items-center justify-center z-10">
                <div className="w-full max-w-3xl">
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl p-12 text-center relative overflow-hidden">
                        {/* Shine Effect */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>

                        <div className="relative z-10">
                            {loading ? (
                                <div className="animate-pulse">
                                    <div className="h-8 bg-white/10 rounded-lg mb-4"></div>
                                    <div className="h-4 bg-white/10 rounded-lg w-2/3 mx-auto"></div>
                                </div>
                            ) : quote ? (
                                <>
                                    {/* Quote Icon */}
                                    <div className="text-6xl text-white/20 mb-6">"</div>

                                    {/* Quote Text */}
                                    <blockquote className="text-2xl md:text-3xl font-serif text-white mb-8 leading-relaxed">
                                        {quote.hitokoto}
                                    </blockquote>

                                    {/* Source */}
                                    <div className="text-gray-400 text-sm space-y-1">
                                        <p className="font-medium">
                                            — {quote.from_who ? `${quote.from_who}，` : ''}{quote.from}
                                        </p>
                                    </div>

                                    {/* Refresh Button */}
                                    <button
                                        onClick={() => {
                                            setLoading(true);
                                            fetch('https://v1.hitokoto.cn/')
                                                .then(res => res.json())
                                                .then(data => {
                                                    setQuote(data);
                                                    setLoading(false);
                                                })
                                                .catch(() => setLoading(false));
                                        }}
                                        className="mt-8 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all duration-300 text-sm font-medium border border-white/20 hover:border-white/30"
                                    >
                                        换一句
                                    </button>
                                </>
                            ) : (
                                <p className="text-white/60">加载失败，请刷新页面</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer - at bottom */}
            <div className="z-10 text-center text-xs text-gray-500 space-y-2 pb-4">
                <p>一言 · Hitokoto</p>
                <p>&copy; {new Date().getFullYear()}</p>
            </div>
        </main>
    );
}
