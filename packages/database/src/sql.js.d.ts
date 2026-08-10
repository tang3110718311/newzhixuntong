declare module "sql.js" {
  export interface SqlJsDatabase {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): unknown[];
    prepare(sql: string): SqlJsStatement;
    close(): void;
    export(): Uint8Array;
    getRowsModified(): number;
  }
  export interface SqlJsStatement {
    bind(params: unknown[]): boolean;
    step(): boolean;
    get(): unknown[];
    getAsObject(): Record<string, unknown>;
    free(): boolean;
  }
  export interface Database extends SqlJsDatabase {}
  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database;
    locateFile(file: string): string;
  }
  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
    wasmBinary?: Uint8Array;
  }): Promise<SqlJsStatic>;
}