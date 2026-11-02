"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react";

const ICONS = {
  mail: Mail,
  lock: Lock,
  user: User,
  phone: Phone,
};

export function AuthInput({
  label,
  icon = "mail",
  type = "text",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: keyof typeof ICONS;
}) {
  const Icon = ICONS[icon];
  const isPassword = type === "password";
  const [show, setShow] = useState(false);
  const inputId = props.id || `auth-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="auth-field">
      <label htmlFor={inputId} className="auth-field-label">
        {label}
      </label>
      <div className="auth-field-control">
      <Icon size={16} className="auth-field-icon" />
      <input
        {...props}
        id={inputId}
        type={isPassword && show ? "text" : type}
        placeholder=""
        className={`auth-field-input ${isPassword ? "pr-12" : ""} ${props.className || ""}`}
      />
      {isPassword ? (
        <button
          type="button"
          className="auth-field-toggle"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setShow((value) => !value);
          }}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      ) : null}
      </div>
    </div>
  );
}

export function AuthAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  return <p className={tone === "success" ? "auth-alert-ok" : "auth-alert"}>{children}</p>;
}

export function AuthSubmit({
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || loading} className={`auth-submit ${props.className || ""}`}>
      {loading ? children : (
        <>
          {children}
          <span aria-hidden className="auth-submit-arrow">
            →
          </span>
        </>
      )}
    </button>
  );
}
