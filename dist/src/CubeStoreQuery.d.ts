import { BaseFilter, BaseQuery } from '@cubejs-backend/schema-compiler';
declare class CubeStoreFilter extends BaseFilter {
    likeIgnoreCase(column: any, not: any, param: any): string;
}
export declare class CubeStoreQuery extends BaseQuery {
    newFilter(filter: any): CubeStoreFilter;
    convertTz(field: any): string;
    timeStampParam(): string;
    timeStampCast(value: any): string;
    inDbTimeZone(date: any): string;
    dateTimeCast(value: any): string;
    subtractInterval(date: any, interval: any): string;
    addInterval(date: any, interval: any): string;
    timeGroupedColumn(granularity: any, dimension: any): string;
    escapeColumnName(name: any): string;
    seriesSql(timeDimension: any): any;
    concatStringsSql(strings: any): string;
    unixTimestampSql(): string;
    wrapSegmentForDimensionSelect(sql: any): string;
    hllMerge(sql: any): string;
    countDistinctApprox(sql: any): string;
}
export {};
//# sourceMappingURL=CubeStoreQuery.d.ts.map