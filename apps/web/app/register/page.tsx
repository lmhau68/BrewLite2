'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, registerAccount } from '@/lib/api';
import { setAccessToken } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await registerAccount({ fullName, email, password });
      setAccessToken(session.accessToken);
      router.push('/orders');
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể tạo tài khoản. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="header">
        <h1 className="header__title">Tạo tài khoản BrewLite</h1>
        <p className="header__subtitle">Mật khẩu cần ít nhất 8 ký tự.</p>
      </header>
      <form className="panel form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Họ tên</span>
          <input
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
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
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
        </button>
        <p>Đã có tài khoản? <Link href="/login">Đăng nhập</Link></p>
      </form>
    </main>
  );
}
