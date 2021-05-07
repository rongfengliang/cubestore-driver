export declare class WebSocketConnection {
    protected messageCounter: number;
    protected webSocket: any;
    private url;
    private options;
    constructor(url: string, options: {});
    protected initWebSocket(): Promise<any>;
    private sendMessage;
    query(query: string): Promise<any[]>;
    close(): void;
}
//# sourceMappingURL=WebSocketConnection.d.ts.map