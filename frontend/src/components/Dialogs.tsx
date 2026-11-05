import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Destructive actions get a red button and start with "Cancelar" focused.
  danger?: boolean;
};

export type FormField = {
  name: string;
  label: string;
  value?: string;
  type?: "text" | "date" | "number" | "textarea";
  required?: boolean;
  min?: number;
  max?: number;
};

type FormOptions = {
  title: string;
  message?: string;
  fields: FormField[];
  confirmLabel?: string;
};

type Request =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (accepted: boolean) => void }
  | { kind: "form"; options: FormOptions; resolve: (values: Record<string, string> | null) => void };

type Dialogs = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  // Resolves with the trimmed value of each field, or null when the user cancels.
  form: (options: FormOptions) => Promise<Record<string, string> | null>;
};

const DialogsContext = createContext<Dialogs | null>(null);

export function useDialogs(): Dialogs {
  const dialogs = useContext(DialogsContext);
  if (!dialogs) throw new Error("useDialogs must be used inside DialogProvider");
  return dialogs;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);

  const open = useCallback((next: Request) => {
    setRequest((current) => {
      // Only one dialog at a time: a new one cancels the one still open.
      if (current?.kind === "confirm") current.resolve(false);
      if (current?.kind === "form") current.resolve(null);
      return next;
    });
  }, []);

  const dialogs = useMemo<Dialogs>(
    () => ({
      confirm: (options) => new Promise((resolve) => open({ kind: "confirm", options, resolve })),
      form: (options) => new Promise((resolve) => open({ kind: "form", options, resolve })),
    }),
    [open],
  );

  return (
    <DialogsContext.Provider value={dialogs}>
      {children}
      {request ? (
        <DialogFrame
          key={request.kind + (request.kind === "confirm" ? request.options.message : request.options.title)}
          request={request}
          onClose={() => setRequest(null)}
        />
      ) : null}
    </DialogsContext.Provider>
  );
}

function DialogFrame({ request, onClose }: { request: Request; onClose: () => void }) {
  const titleId = "dialog-title";
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  function cancel() {
    if (request.kind === "confirm") request.resolve(false);
    else request.resolve(null);
    onClose();
  }

  useEffect(() => {
    previousFocus.current = document.activeElement;
    return () => {
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const title = request.kind === "confirm" ? request.options.title ?? "Confirmar" : request.options.title;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <h2 id={titleId} className="text-xl font-black text-slate-950">
          {title}
        </h2>
        {request.kind === "confirm" ? (
          <ConfirmBody request={request} onClose={onClose} onCancel={cancel} />
        ) : (
          <FormBody request={request} onClose={onClose} onCancel={cancel} />
        )}
      </div>
    </div>
  );
}

function ConfirmBody({
  request,
  onClose,
  onCancel,
}: {
  request: Extract<Request, { kind: "confirm" }>;
  onClose: () => void;
  onCancel: () => void;
}) {
  const { message, confirmLabel = "Aceptar", cancelLabel = "Cancelar", danger = false } = request.options;
  return (
    <>
      <p className="mt-2 whitespace-pre-line font-medium text-slate-600">{message}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" autoFocus={danger} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? "btn-danger" : "btn-primary"}
          autoFocus={!danger}
          onClick={() => {
            request.resolve(true);
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </>
  );
}

function FormBody({
  request,
  onClose,
  onCancel,
}: {
  request: Extract<Request, { kind: "form" }>;
  onClose: () => void;
  onCancel: () => void;
}) {
  const { message, fields, confirmLabel = "Guardar" } = request.options;
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.name, field.value ?? ""])));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.resolve(Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value.trim()])));
    onClose();
  }

  return (
    <form className="mt-2 grid gap-4" onSubmit={submit}>
      {message ? <p className="whitespace-pre-line font-medium text-slate-600">{message}</p> : null}
      {fields.map((field, index) => (
        <label key={field.name} className="grid gap-2 text-sm font-bold text-slate-600">
          {field.label}
          {field.type === "textarea" ? (
            <textarea
              className="input min-h-24"
              autoFocus={index === 0}
              required={field.required}
              value={values[field.name]}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
            />
          ) : (
            <input
              className="input"
              type={field.type ?? "text"}
              autoFocus={index === 0}
              required={field.required}
              min={field.min}
              max={field.max}
              value={values[field.name]}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
            />
          )}
        </label>
      ))}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary">
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}
