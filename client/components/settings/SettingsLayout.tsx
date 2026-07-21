import { ReactNode } from "react";

type SettingsLayoutProps = {
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function SettingsLayout({ sidebar, children, className = "" }: SettingsLayoutProps) {
  return (
    <div className={`min-h-screen bg-slate-50 ${className}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 lg:flex-row lg:px-8">
        {sidebar}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
