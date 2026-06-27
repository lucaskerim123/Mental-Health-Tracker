import UnlockForm from './UnlockForm'

export const dynamic = 'force-dynamic'

export default function UnlockPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <p className="text-zinc-600 font-mono text-[10px] tracking-widest uppercase mb-8 text-center">Emergency Unlock</p>
        <UnlockForm />
      </div>
    </div>
  )
}
