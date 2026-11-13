"use client";

/** Floating-label password input, same look as the booking form fields. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  invalid,
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
}) {
  return (
    <div className="field" data-invalid={Boolean(invalid)}>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
      <label htmlFor={id}>{label}</label>
      <span className="field__bar" aria-hidden />
    </div>
  );
}
