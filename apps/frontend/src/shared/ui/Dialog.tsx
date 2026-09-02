import { PropsWithChildren } from 'react';
import { Modal } from '../components/Modal';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  disableClose?: boolean;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, disableClose, className, children }: PropsWithChildren<DialogProps>) {
  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={title}
      subtitle={description}
      disableClose={disableClose}
      className={className}
    >
      {children}
    </Modal>
  );
}
