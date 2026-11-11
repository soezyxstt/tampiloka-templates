// Node 22 supplies this module; the template still carries Node 20 type definitions.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      columns(): { name: string }[];
      all(...args: any[]): any[];
      run(...args: any[]): any;
    };
    close(): void;
  }
}
