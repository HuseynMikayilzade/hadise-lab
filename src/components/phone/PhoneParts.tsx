import type { ReactNode } from "react";

/** Telefon ekranının ümumi hissələri: başlıq + təlimat, məzmun, yapışqan əsas düymə. */
export function PhoneScreen({ title, instruction, children, action }: { title: string; instruction: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="phone-screen">
      <div className="phone-body">
        <h1>{title}</h1>
        <p className="phone-instruction">{instruction}</p>
        {children}
      </div>
      {action && <div className="sticky-action">{action}</div>}
    </div>
  );
}

export function PrimaryButton({ children, disabled, onClick, type = "button" }: { children: ReactNode; disabled?: boolean; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button type={type} className="btn-primary" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}

export function SuccessCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="success-card" role="status">
      <h2>{title}</h2>
      {children}
      <p className="phone-hint">İndi proyektor ekranına baxın.</p>
    </div>
  );
}

export function BlockedCard({ message }: { message: string }) {
  return (
    <div className="success-card" role="status">
      <h2>{message}</h2>
      <p className="phone-hint">Nəticələri proyektor ekranında izləyin.</p>
    </div>
  );
}
