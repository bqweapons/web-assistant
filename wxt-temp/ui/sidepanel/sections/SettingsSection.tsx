export default function SettingsSection() {
  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Data management</h3>
        <p className="mt-1 text-xs text-slate-500">Import or export saved elements.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost">
            Import
          </button>
          <button type="button" className="btn-ghost">
            Export
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Language</h3>
        <p className="mt-1 text-xs text-slate-500">Pick the language for the side panel.</p>
        <select className="input select mt-3 max-w-xs">
          <option>English</option>
          <option>日本語</option>
          <option>简体中文</option>
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm">
        <h3 className="text-sm font-semibold">Share</h3>
        <p className="mt-1 text-xs text-slate-300">Send the Chrome Web Store link to teammates.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-invert">
            Copy link
          </button>
          <button type="button" className="btn-invert">
            Open store
          </button>
        </div>
      </div>
    </section>
  );
}
