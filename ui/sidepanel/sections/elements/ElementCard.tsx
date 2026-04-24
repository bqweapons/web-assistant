import { Crosshair, Trash2 } from 'lucide-react';
import Card from '../../components/Card';
import { t } from '../../utils/i18n';
import type { ElementRecord } from './normalize';

// Single row in the element list. Kept presentational: card selection,
// locate, and delete are all delegated to the parent so the parent can
// guard on hasActivePage / run the confirm dialog.

type ElementCardProps = {
  element: ElementRecord;
  typeLabel: string;
  elementLabel: string;
  detail: string;
  timestampLabel: string;
  hasActivePage: boolean;
  readOnlyReason: string;
  actionClass: string;
  onSelect?: () => void;
  onFocus: (event: React.MouseEvent, id: string) => void;
  onDelete: (event: React.MouseEvent, id: string) => void;
};

export default function ElementCard({
  element,
  typeLabel,
  elementLabel,
  detail,
  timestampLabel,
  hasActivePage,
  readOnlyReason,
  actionClass,
  onSelect,
  onFocus,
  onDelete,
}: ElementCardProps) {
  return (
    <Card
      className="p-4"
      onClick={hasActivePage ? onSelect : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="badge-pill shrink-0">{typeLabel}</span>
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-card-foreground">
            {elementLabel}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={actionClass}
            aria-label={t('sidepanel_elements_locate', 'Locate element')}
            title={hasActivePage ? t('sidepanel_elements_locate', 'Locate element') : readOnlyReason}
            onClick={(event) => onFocus(event, element.id)}
            disabled={!hasActivePage}
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`${actionClass} btn-icon-danger`}
            aria-label={t('sidepanel_elements_delete', 'Delete element')}
            title={hasActivePage ? t('sidepanel_elements_delete', 'Delete element') : readOnlyReason}
            onClick={(event) => onDelete(event, element.id)}
            disabled={!hasActivePage}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {detail}
        </p>
        <p className="shrink-0 text-xs text-muted-foreground">{timestampLabel}</p>
      </div>
    </Card>
  );
}
