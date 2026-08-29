"use client";

import { CloseIcon } from "@/components/icons";

export function FormDrawer({
  open,
  title,
  onClose,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-navy-900/40" onClick={onClose} />
      <div className={`relative bg-white h-full w-full ${width} shadow-xl flex flex-col`}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-navy-100 shrink-0">
          <h2 className="text-sm font-semibold text-navy-900">{title}</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700">
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
