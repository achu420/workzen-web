import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

function TooltipProvider ({ delayDuration = 0, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider
    data-slot="tooltip-provider"
    delayDuration={delayDuration} {...props} />;
}

// An icon-only button inside a tooltip is described by the tooltip's text for sighted people; screen readers only see
// that text when the tooltip is open. So a plain-text tooltip also becomes the trigger's accessible name, unless the
// trigger already has a label of its own or shows text.
const TooltipLabelContext = React.createContext<string | null>(null);

function plainTextOf (node: React.ReactNode): string | null {
  const parts = React.Children.toArray(node);

  if (parts.length === 0 || !parts.every((part) => typeof part === 'string' || typeof part === 'number')) return null;
  const text = parts.join('').trim();

  return text || null;
}

function tooltipLabelOf (children: React.ReactNode): string | null {
  for (const child of React.Children.toArray(children)) {
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.type === TooltipContent) {
      return plainTextOf(child.props.children);
    }
  }

  return null;
}

function hasVisibleText (node: React.ReactNode): boolean {
  return React.Children.toArray(node).some((child) => {
    if (typeof child === 'string' || typeof child === 'number') return String(child).trim().length > 0;
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && typeof child.type !== 'string') return false;
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) return hasVisibleText(child.props.children);
    return false;
  });
}

function Tooltip ({ children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const label = React.useMemo(() => tooltipLabelOf(children), [children]);

  return (
    <TooltipProvider>
      <TooltipLabelContext.Provider value={label}>
        <TooltipPrimitive.Root data-slot="tooltip" {...props}>{children}</TooltipPrimitive.Root>
      </TooltipLabelContext.Provider>
    </TooltipProvider>
  );
}

function TooltipTrigger ({ children, asChild, ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const label = React.useContext(TooltipLabelContext);
  const named = Boolean(props['aria-label'] || props['aria-labelledby']);
  // With asChild the visible content belongs to the child element, otherwise to the trigger itself.
  const inner = asChild && React.isValidElement<{ children?: React.ReactNode; 'aria-label'?: string; 'aria-labelledby'?: string }>(children) ? children.props : null;
  const innerNamed = Boolean(inner?.['aria-label'] || inner?.['aria-labelledby']);
  const showsText = hasVisibleText(inner ? inner.children : children);
  const ariaLabel = label && !named && !innerNamed && !showsText ? label : undefined;

  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" asChild={asChild} aria-label={ariaLabel} {...props}>{children}</TooltipPrimitive.Trigger>;
}

function TooltipContent ({
  className,
  sideOffset = 0,
  children,
  container,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
  container?: Element;
}) {
  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          // Enter animation only
          'animate-in fade-in-0 zoom-in-95',

          // Slide-in effects based on tooltip position
          'data-[side=bottom]:slide-in-from-top-2',
          'data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2',
          'data-[side=top]:slide-in-from-bottom-2',

          // Styling and layout
          'shadow-tooltip max-w-[360px] z-50 origin-[--radix-tooltip-content-transform-origin]',
          'w-fit rounded-400 bg-surface-inverse px-3 py-2 text-sm text-text-on-fill',
          'flex flex-col whitespace-pre-wrap break-all',

          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

function TooltipShortcut ({ className, ...props }: React.ComponentProps<'span'>) {
  return <span
    data-slot="tooltip-shortcut"
    className={cn('text-text-secondary', className)} {...props} />;
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipShortcut };
