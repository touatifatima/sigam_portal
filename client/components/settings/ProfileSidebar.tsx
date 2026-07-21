import { NavLink } from "react-router-dom";
import { Camera } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SidebarNavItem = {
  to?: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
};

type ProfileSidebarProps = {
  initials: string;
  avatarUrl?: string | null;
  onAvatarClick?: () => void;
  displayName: string;
  role: string;
  plan?: string;
  stats?: Array<{ label: string; value: string | number }>;
  navItems: SidebarNavItem[];
  className?: string;
};

export default function ProfileSidebar({
  initials,
  avatarUrl,
  onAvatarClick,
  displayName,
  role,
  plan = "Pro",
  stats = [],
  navItems,
  className = "",
}: ProfileSidebarProps) {
  return (
    <aside className={`w-full shrink-0 space-y-4 ${className}`}>
      <div className="border border-slate-100 bg-white p-6 text-center shadow-sm">
        <div className="group relative mx-auto h-20 w-20">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800 text-xl font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] ring-4 ring-white">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Photo de profil" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          {onAvatarClick ? (
            <button
              type="button"
              onClick={onAvatarClick}
              title="Modifier la photo"
              aria-label="Modifier la photo"
              className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br from-slate-900 via-slate-700 to-slate-600 text-white shadow-[0_14px_30px_rgba(15,23,42,0.28)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-110 hover:shadow-[0_18px_34px_rgba(15,23,42,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              <Camera size={16} strokeWidth={2.1} />
            </button>
          ) : null}
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-800">{displayName}</h2>
        <p className="text-sm text-slate-400">{role}</p>
        <span className="mt-2 inline-block rounded-full bg-rose-50 px-3 py-0.5 text-xs font-medium text-rose-500">
          {plan}
        </span>

        {stats.length ? (
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-y-0 divide-y divide-slate-100">
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-0 px-2 py-2 text-center sm:py-0">
                <p
                  className="text-[0.82rem] font-semibold leading-snug text-slate-800"
                  style={{
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {stat.value}
                </p>
                <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.08em] text-slate-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <nav className="border border-slate-100 bg-white p-2 shadow-sm">
        {navItems.map(({ to, label, icon: Icon, onClick, active }) =>
          to ? (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `mb-1 flex items-center gap-3 px-4 py-2.5 text-sm transition-colors last:mb-0 ${
                  isActive
                    ? "border-l-2 border-slate-700 bg-slate-100 font-medium text-slate-800"
                    : "text-slate-500 hover:bg-slate-50"
                }`
              }
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ) : (
            <button
              key={label}
              type="button"
              onClick={onClick}
              data-active={active ? "true" : "false"}
              className={`mb-1 flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors last:mb-0 ${
                active
                  ? "border-l-2 border-slate-700 bg-slate-100 font-medium text-slate-800"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </button>
          ),
        )}
      </nav>
    </aside>
  );
}
