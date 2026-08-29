"use client";

import { useRef, useState } from "react";
import { DownloadIcon, UploadIcon } from "@/components/icons";

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportPreviewResponse {
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  duplicateRecords: number;
  errorRecords: number;
  errors: ImportRowError[];
  validRows: unknown[];
}

export function ImportPanel({
  title,
  fileName,
  previewUrl,
  confirmUrl,
  templateUrl,
  onImported,
}: {
  title: string;
  fileName: string;
  previewUrl: string;
  confirmUrl: string;
  templateUrl: string;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [result, setResult] = useState<{ newRecords: number; updatedRecords: number; duplicateRecords: number; errorRecords: number } | null>(null);

  function reset() {
    setPreview(null);
    setError(null);
    setResult(null);
    setShowErrors(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFileSelected(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(previewUrl, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to parse the file");
        return;
      }
      setPreview(data);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(confirmUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.validRows, fileName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }
      setResult(data);
      setPreview(null);
      onImported();
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setOpen(false);
    reset();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setOpen(true);
            handleFileSelected(file);
          }
        }}
      />
      <button className="btn-secondary" onClick={() => inputRef.current?.click()}>
        <UploadIcon /> Upload Excel
      </button>
      <a href={templateUrl} className="btn-secondary" download>
        <DownloadIcon /> Download Template
      </a>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4">
          <div className="card w-full max-w-lg p-5">
            <h3 className="text-sm font-semibold text-navy-900 mb-3">{title}</h3>

            {busy && !preview && !result && <p className="text-sm text-navy-500">Parsing file...</p>}

            {error && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2 mb-3">{error}</div>}

            {preview && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-navy-900">IMPORT PREVIEW</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="card p-2">
                    <div className="text-navy-500 text-xs">Records Found</div>
                    <div className="font-semibold">{preview.totalRecords}</div>
                  </div>
                  <div className="card p-2">
                    <div className="text-navy-500 text-xs">Valid Records</div>
                    <div className="font-semibold text-success-700">{preview.totalRecords - preview.errorRecords}</div>
                  </div>
                  <div className="card p-2">
                    <div className="text-navy-500 text-xs">Records With Errors</div>
                    <div className="font-semibold text-danger-700">{preview.errorRecords}</div>
                  </div>
                </div>
                <div className="text-xs text-navy-500">
                  New: {preview.newRecords} · Updated: {preview.updatedRecords} · Duplicates: {preview.duplicateRecords}
                </div>

                {showErrors && preview.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-navy-100 rounded-md p-2 text-xs space-y-1">
                    {preview.errors.map((e, idx) => (
                      <div key={idx} className="text-danger-700">
                        Row {e.row}: {e.message}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  {preview.errors.length > 0 && (
                    <button className="btn-secondary" onClick={() => setShowErrors((v) => !v)}>
                      {showErrors ? "Hide Errors" : "View Errors"}
                    </button>
                  )}
                  <button className="btn-secondary" onClick={handleClose}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleConfirm}
                    disabled={busy || preview.validRows.length === 0}
                  >
                    {busy ? "Importing..." : "Confirm Import"}
                  </button>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <p className="text-sm text-navy-700">Import complete.</p>
                <div className="text-xs text-navy-600">
                  New: {result.newRecords} · Updated: {result.updatedRecords} · Duplicates: {result.duplicateRecords} · Errors:{" "}
                  {result.errorRecords}
                </div>
                <div className="flex justify-end">
                  <button className="btn-primary" onClick={handleClose}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
