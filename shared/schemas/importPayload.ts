// 3.7 — Runtime schema validation at the import boundary.
//
// Why only import, not messages: MV3 runtime messages are same-extension only
// (no external senders, no `externally_connectable` declared), so their
// threat surface is bounded by the extension code itself. They are already
// discriminated-union-typed at the TS layer in `shared/messages.ts` and the
// dispatcher narrows on `type` before each handler runs.
//
// User-imported JSON files are the one untrusted-input boundary where a
// lightweight runtime validator is clearly worth the cost. Prototype-pollution
// keys are stripped upstream in `stripDangerousKeys`; these schemas layer a
// positive-shape gate on top ("must look like envelope X before we hand off
// to the field-level normalizers").
//
// Scope deliberately stops at envelopes. Site / element / flow / hidden /
// step records keep going through the hand-written normalization path in
// `siteDataMigration.ts` / `flowStepMigration.ts` — those do not *just*
// validate, they also migrate legacy shapes, which is not a pure zod use
// case. A future pass could transcribe the post-normalization shapes into
// zod schemas to act as a post-hoc contract check; out of scope here.

import { z } from 'zod';

// Versioned export (our canonical format, v1.0.2 / v1.0.3).
// `sites` / `settings` are `z.unknown()` so field-level migration still owns
// those shapes; we only gate the top-level envelope.
export const VersionedImportEnvelopeSchema = z.object({
  version: z.string(),
  sites: z.record(z.string(), z.unknown()),
  settings: z.unknown().optional(),
  secretsVault: z.unknown().optional(),
});

// Unversioned "sites bucket without version" — older snapshots produced
// before the envelope carried a `version` field. `version` must be ABSENT
// (if present, we route through the versioned branch instead).
export const UnversionedImportEnvelopeSchema = z.object({
  sites: z.record(z.string(), z.unknown()),
  settings: z.unknown().optional(),
});

// Legacy v1 export: a flat object where each key is a siteKey and each value
// is an array of legacy records. Rejected if the envelope carries a
// top-level `version` or `sites` field — those are caught by the other two
// branches first.
export const LegacyImportEnvelopeSchema = z.record(z.string(), z.array(z.unknown()));

export type VersionedImportEnvelope = z.infer<typeof VersionedImportEnvelopeSchema>;
export type UnversionedImportEnvelope = z.infer<typeof UnversionedImportEnvelopeSchema>;
export type LegacyImportEnvelope = z.infer<typeof LegacyImportEnvelopeSchema>;

// Human-readable error formatter for zod issues. Intentionally not localized:
// import errors are shown inline in the settings dialog and are meant for
// developers / power users debugging a malformed export. User-facing copy for
// the happy path lives in the i18n bundles.
export const formatSchemaError = (error: z.ZodError): string => {
  const issues = error.issues.slice(0, 5).map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
  const suffix = error.issues.length > 5 ? ` (+${error.issues.length - 5} more)` : '';
  return issues.join('; ') + suffix;
};
