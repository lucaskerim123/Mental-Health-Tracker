export default function BannedPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-6 px-4">
        <p className="text-zinc-600 font-mono text-[10px] tracking-widest uppercase">Access Denied</p>
        <p className="text-zinc-400 font-mono text-sm">Your access to this site has been revoked.</p>
        <a href="/login" className="block text-zinc-700 hover:text-zinc-500 font-mono text-[10px] tracking-widest uppercase transition-colors">
          Return to login
        </a>
      </div>
    </div>
  )
}
