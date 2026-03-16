import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Chrome,
  Github,
  Lock,
  Mail,
  QrCode,
  Smartphone,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-4xl w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        <div className="w-full md:w-2/5 bg-zinc-900 dark:bg-black p-8 text-white flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 to-transparent" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <QrCode className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('auth.qrLogin', 'Scan to Login')}</h2>
            <p className="text-zinc-400 text-sm mb-8 max-w-[200px]">
              {t('auth.qrDesc', 'Use the SDKWork mobile app to scan the QR code for instant access.')}
            </p>

            <div className="bg-white p-4 rounded-2xl shadow-xl mb-6">
              <div className="w-48 h-48 bg-zinc-100 rounded-xl border-2 border-dashed border-zinc-300 flex items-center justify-center">
                <QrCode className="w-24 h-24 text-zinc-400" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Smartphone className="w-4 h-4" />
              <span>{t('auth.openApp', 'Open SDKWork App')}</span>
            </div>
          </div>
        </div>

        <div className="w-full md:w-3/5 p-8 md:p-12">
          <div className="max-w-md mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">
                {mode === 'login'
                  ? t('auth.welcomeBack', 'Welcome back')
                  : mode === 'register'
                    ? t('auth.createAccount', 'Create an account')
                    : t('auth.resetPassword', 'Reset password')}
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400">
                {mode === 'login'
                  ? t('auth.loginDesc', 'Enter your details to access your account.')
                  : mode === 'register'
                    ? t('auth.registerDesc', 'Join us to start building amazing things.')
                    : t('auth.resetDesc', 'Enter your email to receive a reset link.')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' ? (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {t('auth.name', 'Full Name')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-zinc-400" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {t('auth.email', 'Email Address')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-zinc-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {mode !== 'forgot' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t('auth.password', 'Password')}
                    </label>
                    {mode === 'login' ? (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors"
                      >
                        {t('auth.forgotPassword', 'Forgot password?')}
                      </button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-zinc-400" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                {mode === 'login'
                  ? t('auth.signIn', 'Sign In')
                  : mode === 'register'
                    ? t('auth.signUp', 'Sign Up')
                    : t('auth.sendResetLink', 'Send Reset Link')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {mode === 'login' ? (
              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-zinc-900 text-zinc-500">
                      {t('auth.continueWith', 'Or continue with')}
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                    <Github className="w-5 h-5" />
                    GitHub
                  </button>
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                    <Chrome className="w-5 h-5" />
                    Google
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
              {mode === 'login' ? (
                <>
                  {t('auth.noAccount', "Don't have an account?")}{' '}
                  <button
                    onClick={() => setMode('register')}
                    className="font-bold text-primary-600 hover:text-primary-500 transition-colors"
                  >
                    {t('auth.signUp', 'Sign up')}
                  </button>
                </>
              ) : mode === 'register' ? (
                <>
                  {t('auth.hasAccount', 'Already have an account?')}{' '}
                  <button
                    onClick={() => setMode('login')}
                    className="font-bold text-primary-600 hover:text-primary-500 transition-colors"
                  >
                    {t('auth.signIn', 'Sign in')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setMode('login')}
                  className="font-bold text-primary-600 hover:text-primary-500 transition-colors flex items-center justify-center gap-1 mx-auto"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  {t('auth.backToLogin', 'Back to login')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
