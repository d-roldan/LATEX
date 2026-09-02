import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => void;
  isPending?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'destructive',
  onConfirm,
  isPending = false
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => { if (!isPending) onOpenChange(isOpen); }}
      disableClose={isPending}
      title={title}
      description={description}
    >
      <div className="dialog-actions">
        <Button
          type="button"
          variant={variant}
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? 'Procesando...' : confirmLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          {cancelLabel}
        </Button>
      </div>
    </Dialog>
  );
}
