import { PropsWithChildren, ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
}

export function Tooltip({ content, children }: PropsWithChildren<TooltipProps>) {
  return (
    <span className="ds-tooltip-anchor">
      {children}
      <span className="ds-tooltip" role="tooltip">{content}</span>
    </span>
  );
}
