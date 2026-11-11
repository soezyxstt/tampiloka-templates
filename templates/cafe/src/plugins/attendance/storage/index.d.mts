export type EvidenceScope = { tenantId: string; outletId: string; employeeId: string };
/** Persist on the server only; this is not an authorization token. */
export type EvidenceReference = { id: string; contentType: 'image/jpeg' | 'image/png' | 'image/webp'; size: number; createdAt: string; expiresAt: string };
export interface EvidenceStore {
  put(scope: EvidenceScope, bytes: Uint8Array, reservedId?: string): Promise<EvidenceReference>;
  read(scope: EvidenceScope, reference: EvidenceReference): Promise<{ bytes: Buffer; contentType: EvidenceReference['contentType'] }>;
  delete(scope: EvidenceScope, reference: EvidenceReference): Promise<void>;
}
export function createLocalEvidenceStore(options: { directory: string; retentionSeconds: number }): EvidenceStore;
export function createS3EvidenceStore(options: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; sessionToken?: string; retentionSeconds: number; fetch?: typeof fetch; clock?: () => Date }): EvidenceStore;
