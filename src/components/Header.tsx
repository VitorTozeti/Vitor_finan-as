import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-lg px-5 pt-6 pb-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
        {!online && (
          <div className="flex items-center gap-1.5 rounded-full bg-warn/10 px-3 py-1.5 text-xs font-medium text-warn">
            <WifiOff size={13} />
            Offline
          </div>
        )}
      </div>
    </header>
  )
}
