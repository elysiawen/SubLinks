export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white animate-fade-in">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex border p-24 rounded-2xl border-gray-700 bg-gray-800">
        <div className="text-center w-full">
          <h1 className="text-4xl font-bold mb-4">Subscription System</h1>
          <p className="text-gray-400">
            System is active and running.
          </p>
          <p className="mt-4 text-xs text-gray-500">
            Please use your provided subscription link to access services.
          </p>
        </div>
      </div>
    </main>
  );
}
