import { useState } from 'react';
import { Dialog } from '../../shared/ui/Dialog';
import { Button } from '../../shared/ui/Button';
import { Input } from '../../shared/ui/Input';
import { api as http } from '../../shared/api/http';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { clearSessionAndRedirect } from './session';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await http.patch('/auth/change-password', {
        oldPassword,
        newPassword
      });
      setSuccess(true);
      setTimeout(() => clearSessionAndRedirect(), 1800);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} title="Cambiar Contraseña">
      {success ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">¡Éxito!</h3>
          <p className="text-muted-foreground">Tu contraseña fue actualizada. Por seguridad, deberás volver a iniciar sesión.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-200/80 mb-4 flex gap-3">
             <Lock className="shrink-0 w-4 h-4 mt-0.5" />
             <p>Por seguridad, ingresá tu contraseña actual antes de definir la nueva.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--ink-soft)]">Contraseña Actual</label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--ink-soft)]">Nueva Contraseña</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--ink-soft)]">Confirmar Nueva Contraseña</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Cambiar Contraseña'
              )}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
