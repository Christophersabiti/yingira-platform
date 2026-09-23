'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Result } from '@/lib/contracts';
export async function command<T>(
  body: Record<string, unknown>,
): Promise<Result<T>> {
  const response = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await response.json();
}
export function CommandForm({
  action,
  values = {},
  children,
  label = 'Save',
  navigate,
  numeric = [],
  onSuccess,
}: {
  action: string;
  values?: Record<string, unknown>;
  children?: React.ReactNode;
  label?: string;
  navigate?: string;
  numeric?: string[];
  onSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget;
        setBusy(true);
        setError('');
        try {
          const data: Record<string, unknown> = Object.fromEntries(
            new FormData(form),
          );
          for (const key of numeric) data[key] = Number(data[key]);
          if (data.startsAt)
            data.startsAt = new Date(String(data.startsAt)).toISOString();
          const result = await command<{ id?: string }>({
            action,
            ...values,
            ...data,
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          form.reset();
          onSuccess?.();
          if (navigate)
            router.push(navigate.replace(':id', result.data.id ?? ''));
          router.refresh();
        } catch {
          setError(
            'The result could not be confirmed. Refresh to check before trying again.',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <button disabled={busy} className="button">
        {busy ? 'Saving…' : label}
      </button>
    </form>
  );
}
