import { PropsWithChildren, ReactNode } from 'react';
import { Modal } from '../components/Modal';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  disableClose?: boolean;
  className?: string;
  headerActions?: ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  disableClose,
  className,
  headerActions,
  children
}: PropsWithChildren<DialogProps>) {
  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={title}
      subtitle={description}
      disableClose={disableClose}
      className={className}
      headerActions={headerActions}
    >
      {children}
    </Modal>
  );
}
