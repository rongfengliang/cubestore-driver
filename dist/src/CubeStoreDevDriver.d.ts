/// <reference types="node" />
import { CubeStoreHandler } from '@cubejs-backend/cubestore';
import { CubeStoreDriver } from './CubeStoreDriver';
import { ConnectionConfig } from './types';
export declare class CubeStoreDevDriver extends CubeStoreDriver {
    protected readonly cubeStoreHandler: CubeStoreHandler;
    constructor(cubeStoreHandler: CubeStoreHandler, config?: Partial<ConnectionConfig>);
    protected acquireCubeStore(): Promise<import("child_process").ChildProcess>;
    query(query: any, values: any): Promise<any[]>;
}
//# sourceMappingURL=CubeStoreDevDriver.d.ts.map