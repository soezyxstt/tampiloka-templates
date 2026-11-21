import { IdbFs } from '@electric-sql/pglite';

export class RecoverableIdbFs extends IdbFs {
  override async syncToFs(relaxedDurability?: boolean): Promise<void> {
    try {
      await super.syncToFs(relaxedDurability);
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'InvalidStateError'
        || !/connection is (?:closing|closed)/i.test(error.message) || this.pg?.closed) throw error;
      // shortcut: PGlite 0.3.16 caches closed IDB handles; remove when upstream reconnects them.
      const databases = this.pg!.Module.FS.filesystems.IDBFS.dbs as Record<string, IDBDatabase>;
      const mount = `/pglite/${this.dataDir}`;
      const database = databases[mount];
      if (!database) throw error;
      database.close();
      delete databases[mount];
      // Retry only persistence of the existing in-memory state, never the SQL command.
      await super.syncToFs(relaxedDurability);
    }
  }
}
