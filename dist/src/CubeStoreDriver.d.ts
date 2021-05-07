import { BaseDriver } from '@cubejs-backend/query-orchestrator';
import { CubeStoreQuery } from './CubeStoreQuery';
import { ConnectionConfig } from './types';
import { WebSocketConnection } from './WebSocketConnection';
declare type Column = {
    type: string;
    name: string;
};
export declare class CubeStoreDriver extends BaseDriver {
    protected readonly config: any;
    protected readonly connection: WebSocketConnection;
    protected readonly baseUrl: string;
    constructor(config?: Partial<ConnectionConfig>);
    testConnection(): Promise<void>;
    query(query: any, values: any): Promise<any[]>;
    release(): Promise<void>;
    informationSchemaQuery(): string;
    quoteIdentifier(identifier: string): string;
    fromGenericType(columnType: string): string;
    toColumnValue(value: any, genericType: any): any;
    uploadTableWithIndexes(table: string, columns: Column[], tableData: any, indexesSql: any): Promise<void>;
    private importRows;
    private importCsvFile;
    private importStream;
    static dialectClass(): typeof CubeStoreQuery;
    capabilities(): {
        csvImport: boolean;
        streamImport: boolean;
    };
}
export {};
//# sourceMappingURL=CubeStoreDriver.d.ts.map