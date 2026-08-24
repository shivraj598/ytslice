import { useRef, useEffect } from 'react';

interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  const toastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && toastRef.current) {
      toastRef.current.classList.add('show');
      const timer = setTimeout(() => {
        toastRef.current?.classList.remove('show');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!message) return null;

  return (
    <div className="toast" ref={toastRef} role="status" aria-live="polite">
      {message}
    </div>
  );
}