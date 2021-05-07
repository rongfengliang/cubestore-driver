"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CubeStoreDriver = void 0;
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const fs_1 = require("fs");
const fs_extra_1 = require("fs-extra");
const tempy_1 = __importDefault(require("tempy"));
const csv_write_stream_1 = __importDefault(require("csv-write-stream"));
const query_orchestrator_1 = require("@cubejs-backend/query-orchestrator");
const shared_1 = require("@cubejs-backend/shared");
const sqlstring_1 = require("sqlstring");
const node_fetch_1 = __importDefault(require("node-fetch"));
const CubeStoreQuery_1 = require("./CubeStoreQuery");
const WebSocketConnection_1 = require("./WebSocketConnection");
const GenericTypeToCubeStore = {
    string: 'varchar(255)',
    text: 'varchar(255)'
};
class CubeStoreDriver extends query_orchestrator_1.BaseDriver {
    constructor(config) {
        super();
        this.config = {
            ...config,
            host: (config === null || config === void 0 ? void 0 : config.host) || shared_1.getEnv('cubeStoreHost'),
            port: (config === null || config === void 0 ? void 0 : config.port) || shared_1.getEnv('cubeStorePort'),
            user: (config === null || config === void 0 ? void 0 : config.user) || shared_1.getEnv('cubeStoreUser'),
            password: (config === null || config === void 0 ? void 0 : config.password) || shared_1.getEnv('cubeStorePass'),
        };
        this.baseUrl = (this.config.url || `ws://${this.config.host || 'localhost'}:${this.config.port || '3030'}/`).replace(/\/ws$/, '/').replace(/\/$/, '');
        var authHeader = {};
        if (this.config.user && this.config.password) {
            var base64Str = Buffer.from(`${this.config.user}:${this.config.password}`).toString('base64');
            authHeader = {
                'Authorization': `Basic ${base64Str}`
            };
        }
        this.connection = new WebSocketConnection_1.WebSocketConnection(`${this.baseUrl}/ws`, authHeader);
    }
    async testConnection() {
        await this.query('SELECT 1', []);
    }
    async query(query, values) {
        return this.connection.query(sqlstring_1.format(query, values || []));
    }
    async release() {
        return this.connection.close();
    }
    informationSchemaQuery() {
        return `${super.informationSchemaQuery()} AND columns.table_schema = '${this.config.database}'`;
    }
    quoteIdentifier(identifier) {
        return `\`${identifier}\``;
    }
    fromGenericType(columnType) {
        return GenericTypeToCubeStore[columnType] || super.fromGenericType(columnType);
    }
    toColumnValue(value, genericType) {
        if (genericType === 'timestamp' && typeof value === 'string') {
            return value && value.replace('Z', '');
        }
        if (genericType === 'boolean' && typeof value === 'string') {
            if (value.toLowerCase() === 'true') {
                return true;
            }
            if (value.toLowerCase() === 'false') {
                return false;
            }
        }
        return super.toColumnValue(value, genericType);
    }
    async uploadTableWithIndexes(table, columns, tableData, indexesSql) {
        const indexes = indexesSql.map((s) => s.sql[0].replace(/^CREATE INDEX (.*?) ON (.*?) \((.*)$/, 'INDEX $1 ($3')).join(' ');
        if (tableData.rowStream) {
            await this.importStream(columns, tableData, table, indexes);
        }
        else if (tableData.csvFile) {
            await this.importCsvFile(tableData, table, columns, indexes);
        }
        else if (tableData.rows) {
            await this.importRows(table, columns, indexesSql, tableData);
        }
        else {
            throw new Error(`Unsupported table data passed to ${this.constructor}`);
        }
    }
    async importRows(table, columns, indexesSql, tableData) {
        await this.createTable(table, columns);
        try {
            for (let i = 0; i < indexesSql.length; i++) {
                const [query, params] = indexesSql[i].sql;
                await this.query(query, params);
            }
            const batchSize = 2000; // TODO make dynamic?
            for (let j = 0; j < Math.ceil(tableData.rows.length / batchSize); j++) {
                const currentBatchSize = Math.min(tableData.rows.length - j * batchSize, batchSize);
                const indexArray = Array.from({ length: currentBatchSize }, (v, i) => i);
                const valueParamPlaceholders = indexArray.map(i => `(${columns.map((c, paramIndex) => this.param(paramIndex + i * columns.length)).join(', ')})`).join(', ');
                const params = indexArray.map(i => columns
                    .map(c => this.toColumnValue(tableData.rows[i + j * batchSize][c.name], c.type)))
                    .reduce((a, b) => a.concat(b), []);
                await this.query(`INSERT INTO ${table}
        (${columns.map(c => this.quoteIdentifier(c.name)).join(', ')})
        VALUES ${valueParamPlaceholders}`, params);
            }
        }
        catch (e) {
            await this.dropTable(table);
            throw e;
        }
    }
    async importCsvFile(tableData, table, columns, indexes) {
        const files = Array.isArray(tableData.csvFile) ? tableData.csvFile : [tableData.csvFile];
        const createTableSql = this.createTableSql(table, columns);
        // eslint-disable-next-line no-unused-vars
        const createTableSqlWithLocation = `${createTableSql} ${indexes} LOCATION ${files.map(() => '?').join(', ')}`;
        await this.query(createTableSqlWithLocation, files).catch(e => {
            e.message = `Error during create table: ${createTableSqlWithLocation}: ${e.message}`;
            throw e;
        });
    }
    async importStream(columns, tableData, table, indexes) {
        const writer = csv_write_stream_1.default({ headers: columns.map(c => c.name) });
        const gzipStream = zlib_1.createGzip();
        const tempFile = tempy_1.default.file();
        try {
            const outputStream = fs_1.createWriteStream(tempFile);
            await new Promise((resolve, reject) => stream_1.pipeline(tableData.rowStream, writer, gzipStream, outputStream, (err) => (err ? reject(err) : resolve(null))));
            const fileName = `${table}.csv.gz`;
            const res = await node_fetch_1.default(`${this.baseUrl.replace(/^ws/, 'http')}/upload-temp-file?name=${fileName}`, {
                method: 'POST',
                body: fs_1.createReadStream(tempFile),
            });
            const createTableSql = this.createTableSql(table, columns);
            // eslint-disable-next-line no-unused-vars
            const createTableSqlWithLocation = `${createTableSql} ${indexes} LOCATION ?`;
            if (res.status !== 200) {
                const err = await res.json();
                throw new Error(`Error during create table: ${createTableSqlWithLocation}: ${err.error}`);
            }
            await this.query(createTableSqlWithLocation, [`temp://${fileName}`]).catch(e => {
                e.message = `Error during create table: ${createTableSqlWithLocation}: ${e.message}`;
                throw e;
            });
        }
        finally {
            await fs_extra_1.unlink(tempFile);
        }
    }
    static dialectClass() {
        return CubeStoreQuery_1.CubeStoreQuery;
    }
    capabilities() {
        return {
            csvImport: true,
            streamImport: true,
        };
    }
}
exports.CubeStoreDriver = CubeStoreDriver;
//# sourceMappingURL=CubeStoreDriver.js.map