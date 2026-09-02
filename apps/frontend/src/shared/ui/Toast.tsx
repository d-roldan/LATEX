import { useState, useCallback, createContext, useContext, PropsWithChildren } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface ToastItem {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'warning';
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastItem['variant']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, variant: ToastItem['variant'] = 'success') => {
    const id = crypto.randomUUID();
    setToasts((previous) => [...previous, { id, message, variant }]);
    setTimeout(() => {
      setToasts((previous) => previous.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const iconMap: Record<ToastItem['variant'], typeof CheckCircle2> = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((item) => {
          const Icon = iconMap[item.variant];
          return (
            <div key={item.id} className={`toast toast--${item.variant}`}>
              <Icon className="toast__icon" size={19} aria-hidden="true" />
              <span>{item.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue['toast'] {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context.toast;
}
