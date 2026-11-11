import { FormEvent, useState } from 'react'
import { Eye, EyeOff, Lock, Mail, User, Cloud, ShieldCheck, LineChart } from 'lucide-react'
import { useAuth } from '../store/useAuth'

type Mode = 'login' | 'register'

const inputCls =
  'w-full rounded-xl bg-card border border-line/10 pl-10 pr-4 py-3 text-sm outline-none focus:border-green transition-colors'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === 'register' && password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, name.trim() || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg text-txt flex flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-green mx-auto flex items-center justify-center text-bg font-bold text-2xl mb-4">
            G
          </div>
          <h1 className="text-2xl font-bold">GreenFinance</h1>
          <p className="text-sm text-muted mt-1.5">
            {mode === 'login' ? 'Entre para ver suas finanças em qualquer aparelho.' : 'Crie sua conta grátis em segundos.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-card p-1 mb-5" role="tablist">
          {(['login', 'register'] as Mode[]).map(m => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m)
                setError(null)
              }}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === m ? 'bg-green text-bg' : 'text-muted hover:text-txt'
              }`}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <label className="relative block">
              <span className="sr-only">Nome</span>
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome (opcional)"
                autoComplete="name"
                className={inputCls}
              />
            </label>
          )}
          <label className="relative block">
            <span className="sr-only">E-mail</span>
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-mail"
              autoComplete="email"
              className={inputCls}
            />
          </label>
          <label className="relative block">
            <span className="sr-only">Senha</span>
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type={showPass ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Senha (mín. 8 caracteres)' : 'Senha'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={`${inputCls} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-txt"
              aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-green py-3.5 font-semibold text-bg disabled:opacity-60"
          >
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <ul className="mt-8 space-y-2.5 text-xs text-muted">
          <li className="flex items-center gap-2.5">
            <Cloud size={14} className="text-green shrink-0" /> Dados salvos na nuvem e sincronizados entre aparelhos.
          </li>
          <li className="flex items-center gap-2.5">
            <LineChart size={14} className="text-green shrink-0" /> Carteira com cotações ao vivo da B3.
          </li>
          <li className="flex items-center gap-2.5">
            <ShieldCheck size={14} className="text-green shrink-0" /> Senha criptografada; cada conta só vê os próprios dados.
          </li>
        </ul>
      </div>
    </div>
  )
}
