'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, loginAccount } from '@/lib/api';
import { setAccessToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await loginAccount({ email, password });
      setAccessToken(session.accessToken);
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next?.startsWith('/') ? next : '/orders');
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể đăng nhập. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="header">
        <h1 className="header__title">Đăng nhập BrewLite</h1>
        <p className="header__subtitle">Đăng nhập để đặt hàng và theo dõi đơn.</p>
      </header>
      <form className="panel form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            maxLength={320}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Mật khẩu</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        <p>Chưa có tài khoản? <Link href="/register">Đăng ký</Link></p>
      </form>
    </main>
  );
}
