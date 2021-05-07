"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CubeStoreDevDriver = void 0;
const CubeStoreDriver_1 = require("./CubeStoreDriver");
class CubeStoreDevDriver extends CubeStoreDriver_1.CubeStoreDriver {
    constructor(cubeStoreHandler, config) {
        super({
            ...config,
            host: '127.0.0.1',
            // CubeStoreDriver is using env variables, let's override it by undefined
            user: undefined,
            password: undefined,
            // @todo Make random port selection when 13306 is already used?
            port: 3030,
        });
        this.cubeStoreHandler = cubeStoreHandler;
    }
    async acquireCubeStore() {
        return this.cubeStoreHandler.acquire();
    }
    async query(query, values) {
        await this.acquireCubeStore();
        return super.query(query, values);
    }
}
exports.CubeStoreDevDriver = CubeStoreDevDriver;
//# sourceMappingURL=CubeStoreDevDriver.js.map