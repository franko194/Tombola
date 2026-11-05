import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

// Password field with a button to show what was typed, useful on phones where typos are common.
export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`input !pr-12 ${className}`} />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-900"
        aria-label={label}
        aria-pressed={visible}
        title={label}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
