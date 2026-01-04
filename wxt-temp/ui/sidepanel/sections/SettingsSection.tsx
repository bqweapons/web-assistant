import Card from '../components/Card';

export default function SettingsSection() {
  return (
    <section className="flex flex-col gap-2">
      <Card>
        <h3 className="text-sm font-semibold text-card-foreground">Data management</h3>
        <p className="mt-2 text-xs text-muted-foreground">Import or export saved elements.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost">
            Import
          </button>
          <button type="button" className="btn-ghost">
            Export
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-card-foreground">Language</h3>
        <p className="mt-2 text-xs text-muted-foreground">Pick the language for the side panel.</p>
        <select className="input select mt-2 max-w-xs">
          <option>English</option>
          <option>日本語</option>
          <option>简体中文</option>
        </select>
      </Card>

      <Card className="bg-primary text-primary-foreground">
        <h3 className="text-sm font-semibold">Share</h3>
        <p className="mt-2 text-xs text-primary-foreground opacity-80">Send the Chrome Web Store link to teammates.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-invert">
            Copy link
          </button>
          <button type="button" className="btn-invert">
            Open store
          </button>
        </div>
      </Card>
    </section>
  );
}



