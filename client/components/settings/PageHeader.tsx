type PageHeaderProps = {
  crumb: string;
};

export default function PageHeader({ crumb }: PageHeaderProps) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold text-slate-800">Settings</h1>
      <p className="mt-0.5 text-sm text-slate-400">
        Home <span className="mx-1">/</span> Settings
        <span className="mx-1">/</span>
        <span className="text-slate-500">{crumb}</span>
      </p>
    </div>
  );
}
