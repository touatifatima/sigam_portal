import { ReactNode } from "react";

type CardProps = {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function Card({ title, action, children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-lg border border-slate-100 bg-white shadow-sm ${className}`}
    >
      {title ? (
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {action}
        </div>
      ) : null}
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}
