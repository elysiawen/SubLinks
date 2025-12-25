import Link from 'next/link';
import { db } from '@/lib/db';

export default async function Home() {
  const config = await db.getGlobalConfig();
  const customBg = config.customBackgroundUrl;

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center p-6 animate-fade-in relative overflow-hidden"
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
          <div className="absolute inset-0 bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black"></div>
          <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-purple-500/20 rounded-full blur-[128px] pointer-events-none"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] pointer-events-none"></div>
        </>
      )}

      {/* Dark overlay for custom backgrounds to ensure text readability */}
      {customBg && (
        <div className="absolute inset-0 bg-black/40"></div>
      )}

      <div className="z-10 w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden">
          {/* Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>

          <div className="relative z-10">
            <h1 className="text-4xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 tracking-tight drop-shadow-sm">
              System Ready
            </h1>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed font-medium">
              系统运行正常<br />
              随时准备就绪
            </p>

            <div className="space-y-4">
              <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-white/5">
                <p>Access Restricted</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-600">
          &copy; {new Date().getFullYear()} System
        </div>
      </div>
    </main>
  );
}
