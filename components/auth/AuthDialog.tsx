"use client";

import { useEffect, useRef } from "react";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import "@/app/signup/signup.css";
import "./auth-dialog.css";

export default function AuthDialog({ mode, onSwitch, onClose, onLogin }: {
  mode: "login" | "signup";
  onSwitch: (mode: "login" | "signup") => void;
  onClose: () => void;
  onLogin: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  return <dialog ref={dialog} className="pz-auth-dialog" data-mode={mode} aria-labelledby="auth-form-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <button className="pz-auth-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
    <div className="pz-auth-scroll" key={mode}>
      {mode === "login"
        ? <LoginForm onSuccess={onLogin} onSwitch={() => onSwitch("signup")} />
        : <SignupForm onSuccess={() => onSwitch("login")} onSwitch={() => onSwitch("login")} />}
    </div>
  </dialog>;
}
