"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CubeStoreQuery = void 0;
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const schema_compiler_1 = require("@cubejs-backend/schema-compiler");
const GRANULARITY_TO_INTERVAL = {
    day: 'day',
    week: 'week',
    hour: 'hour',
    minute: 'minute',
    second: 'second',
    month: 'month',
    year: 'year'
};
class CubeStoreFilter extends schema_compiler_1.BaseFilter {
    likeIgnoreCase(column, not, param) {
        return `${column}${not ? ' NOT' : ''} LIKE CONCAT('%', ${this.allocateParam(param)}, '%')`;
    }
}
class CubeStoreQuery extends schema_compiler_1.BaseQuery {
    newFilter(filter) {
        return new CubeStoreFilter(this, filter);
    }
    convertTz(field) {
        return `CONVERT_TZ(${field}, '${moment_timezone_1.default().tz(this.timezone).format('Z')}')`;
    }
    timeStampParam() {
        return 'to_timestamp(?)';
    }
    timeStampCast(value) {
        return `CAST(${value} as TIMESTAMP)`; // TODO
    }
    inDbTimeZone(date) {
        return this.inIntegrationTimeZone(date).clone().utc().format(moment_timezone_1.default.HTML5_FMT.DATETIME_LOCAL_MS);
    }
    dateTimeCast(value) {
        return `to_timestamp(${value})`;
    }
    subtractInterval(date, interval) {
        return `DATE_SUB(${date}, INTERVAL ${interval})`;
    }
    addInterval(date, interval) {
        return `DATE_ADD(${date}, INTERVAL ${interval})`;
    }
    timeGroupedColumn(granularity, dimension) {
        return `date_trunc('${GRANULARITY_TO_INTERVAL[granularity]}', ${dimension})`;
    }
    escapeColumnName(name) {
        return `\`${name}\``;
    }
    seriesSql(timeDimension) {
        const values = timeDimension.timeSeries().map(([from, to]) => `select to_timestamp('${from}') date_from, to_timestamp('${to}') date_to`).join(' UNION ALL ');
        return values;
    }
    concatStringsSql(strings) {
        return `CONCAT(${strings.join(', ')})`;
    }
    unixTimestampSql() {
        return 'UNIX_TIMESTAMP()';
    }
    wrapSegmentForDimensionSelect(sql) {
        return `IF(${sql}, 1, 0)`;
    }
    hllMerge(sql) {
        return `cardinality(merge(${sql}))`;
    }
    countDistinctApprox(sql) {
        // TODO: We should throw an error, but this gets called even when only `hllMerge` result is used.
        return `approx_distinct_is_unsupported_in_cubestore(${sql}))`;
    }
}
exports.CubeStoreQuery = CubeStoreQuery;
//# sourceMappingURL=CubeStoreQuery.js.map