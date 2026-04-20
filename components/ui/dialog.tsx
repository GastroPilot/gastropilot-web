"use client";

import * as React from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  disableOverlayPointerEvents?: boolean;
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  showClose?: boolean;
}

interface DialogHeaderProps {
  children: React.ReactNode;
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogDescriptionProps {
  children: React.ReactNode;
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, children, disableOverlayPointerEvents }: DialogProps) {
  if (!open) return null;

  const overlayPointerClass = disableOverlayPointerEvents ? "pointer-events-none" : "";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className={`fixed inset-0 bg-black/50 ${overlayPointerClass}`}
        onClick={disableOverlayPointerEvents ? undefined : () => onOpenChange(false)}
      />
      {children}
    </div>
  );
}

export function DialogContent({ children, className = "", onClose, showClose = true }: DialogContentProps) {
  return (
    <div
      className={`
        relative z-[100] w-screen max-w-none border border-border bg-card shadow-xl
        h-[100dvh] max-h-[100dvh] overflow-y-auto overscroll-contain
        rounded-none sm:mx-4 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:rounded-lg md:mx-6 md:max-w-2xl
        ${className}
      `}
      onClick={(e) => e.stopPropagation()}
    >
      {onClose && showClose && (
        <button
          className="absolute right-3 top-3 z-[110] flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md bg-muted px-3 py-2 text-xl font-bold leading-none text-foreground touch-manipulation hover:bg-accent sm:right-2 sm:top-2 sm:min-h-[36px] sm:min-w-[36px]"
          onClick={onClose}
          aria-label="Schließen"
        >
          ×
        </button>
      )}
      {children}
    </div>
  );
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4">{children}</div>;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return <h2 className={className || "text-lg md:text-xl font-semibold text-card-foreground"}>{children}</h2>;
}

export function DialogDescription({ children }: DialogDescriptionProps) {
  return <p className="text-sm text-muted-foreground mt-1">{children}</p>;
}

export function DialogFooter({ children, className = "" }: DialogFooterProps) {
  return (
    <div className={`px-4 md:px-6 py-3 md:py-4 border-t border-border flex flex-col md:flex-row justify-end gap-2 md:gap-3 ${className}`}>
      {children}
    </div>
  );
}
