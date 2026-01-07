import { Copy, Download, ExternalLink, Globe, Languages, Share2, Upload } from 'lucide-react';
import Card from '../components/Card';

export default function SettingsSection() {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-card-foreground">Settings</h2>
        <p className="mt-1 text-xs text-muted-foreground">Fine-tune data, language, and sharing.</p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Data management</h3>
              <p className="mt-1 text-xs text-muted-foreground">Import or export saved elements and flows.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost gap-2">
              <Upload className="h-4 w-4" />
              Import
            </button>
            <button type="button" className="btn-primary gap-2">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 rounded border border-border bg-muted p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>Last export</span>
            <span className="text-foreground">Never</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Stored items</span>
            <span className="text-foreground">12 rules</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground">
            <Languages className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-card-foreground">Language</h3>
            <p className="mt-1 text-xs text-muted-foreground">Pick the language for the side panel.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <select className="input select">
                <option>English (US)</option>
                <option>Japanese</option>
                <option>Simplified Chinese</option>
              </select>
              <span className="text-xs text-muted-foreground">Locale: en-US</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Share2 className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-card-foreground">Share</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Send the Chrome Web Store link to teammates.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary gap-2">
                <Copy className="h-4 w-4" />
                Copy link
              </button>
              <button type="button" className="btn-ghost gap-2">
                <ExternalLink className="h-4 w-4" />
                Open store
              </button>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5" />
              Chrome Web Store
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
