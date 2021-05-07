"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketConnection = void 0;
const ws_1 = __importDefault(require("ws"));
const flatbuffers_1 = require("flatbuffers");
const HttpMessage_1 = require("../codegen/HttpMessage");
class WebSocketConnection {
    constructor(url, options) {
        this.url = url;
        this.messageCounter = 1;
        this.options = options;
    }
    async initWebSocket() {
        if (!this.webSocket) {
            const webSocket = new ws_1.default(this.url, this.options);
            webSocket.readyPromise = new Promise((resolve, reject) => {
                webSocket.lastHeartBeat = new Date();
                const pingInterval = setInterval(() => {
                    if (webSocket.readyState === ws_1.default.OPEN) {
                        webSocket.ping();
                    }
                    if (new Date().getTime() - webSocket.lastHeartBeat.getTime() > 30000) {
                        webSocket.close();
                    }
                }, 5000);
                webSocket.sendAsync = async (message) => new Promise((resolveSend, rejectSend) => {
                    webSocket.send(message, (err) => {
                        if (err) {
                            rejectSend(err);
                        }
                        else {
                            resolveSend();
                        }
                    });
                });
                webSocket.on('open', () => resolve(webSocket));
                webSocket.on('error', (err) => {
                    reject(err);
                    if (webSocket === this.webSocket) {
                        this.webSocket = undefined;
                    }
                });
                webSocket.on('pong', () => {
                    webSocket.lastHeartBeat = new Date();
                });
                webSocket.on('close', () => {
                    clearInterval(pingInterval);
                    if (Object.keys(webSocket.sentMessages).length) {
                        setTimeout(async () => {
                            try {
                                const nextWebSocket = await this.initWebSocket();
                                // eslint-disable-next-line no-restricted-syntax
                                for (const key of Object.keys(webSocket.sentMessages)) {
                                    nextWebSocket.sentMessages[key] = webSocket.sentMessages[key];
                                    await nextWebSocket.sendAsync(webSocket.sentMessages[key].buffer);
                                }
                            }
                            catch (e) {
                                // eslint-disable-next-line no-restricted-syntax
                                for (const key of Object.keys(webSocket.sentMessages)) {
                                    webSocket.sentMessages[key].reject(e);
                                }
                            }
                        }, 1000);
                    }
                    if (webSocket === this.webSocket) {
                        this.webSocket = undefined;
                    }
                });
                webSocket.on('message', (msg) => {
                    var _a;
                    const buf = new flatbuffers_1.flatbuffers.ByteBuffer(msg);
                    const httpMessage = HttpMessage_1.HttpMessage.getRootAsHttpMessage(buf);
                    const resolvers = webSocket.sentMessages[httpMessage.messageId()];
                    delete webSocket.sentMessages[httpMessage.messageId()];
                    if (!resolvers) {
                        throw new Error(`Cube Store missed message id: ${httpMessage.messageId()}`); // logging
                    }
                    const commandType = httpMessage.commandType();
                    if (commandType === HttpMessage_1.HttpCommand.HttpError) {
                        resolvers.reject(new Error(`${(_a = httpMessage.command(new HttpMessage_1.HttpError())) === null || _a === void 0 ? void 0 : _a.error()}`));
                    }
                    else if (commandType === HttpMessage_1.HttpCommand.HttpResultSet) {
                        const resultSet = httpMessage.command(new HttpMessage_1.HttpResultSet());
                        if (!resultSet) {
                            resolvers.reject(new Error('Empty resultSet'));
                            return;
                        }
                        const columnsLen = resultSet.columnsLength();
                        const columns = [];
                        for (let i = 0; i < columnsLen; i++) {
                            const columnName = resultSet.columns(i);
                            if (!columnName) {
                                resolvers.reject(new Error('Column name is not defined'));
                                return;
                            }
                            columns.push(columnName);
                        }
                        const rowLen = resultSet.rowsLength();
                        const result = [];
                        for (let i = 0; i < rowLen; i++) {
                            const row = resultSet.rows(i);
                            if (!row) {
                                resolvers.reject(new Error('Null row'));
                                return;
                            }
                            const valueLen = row.valuesLength();
                            const rowObj = {};
                            for (let j = 0; j < valueLen; j++) {
                                const value = row.values(j);
                                rowObj[columns[j]] = value === null || value === void 0 ? void 0 : value.stringValue();
                            }
                            result.push(rowObj);
                        }
                        resolvers.resolve(result);
                    }
                    else {
                        resolvers.reject(new Error('Unsupported command'));
                    }
                });
            });
            webSocket.sentMessages = {};
            this.webSocket = webSocket;
        }
        return this.webSocket.readyPromise;
    }
    async sendMessage(messageId, buffer) {
        const socket = await this.initWebSocket();
        return new Promise((resolve, reject) => {
            socket.send(buffer, (err) => {
                if (err) {
                    delete socket.sentMessages[messageId];
                    reject(err);
                }
            });
            socket.sentMessages[messageId] = {
                resolve,
                reject,
                buffer
            };
        });
    }
    async query(query) {
        const builder = new flatbuffers_1.flatbuffers.Builder(1024);
        const queryOffset = builder.createString(query);
        const httpQueryOffset = HttpMessage_1.HttpQuery.createHttpQuery(builder, queryOffset);
        const messageId = this.messageCounter++;
        const message = HttpMessage_1.HttpMessage.createHttpMessage(builder, messageId, HttpMessage_1.HttpCommand.HttpQuery, httpQueryOffset);
        builder.finish(message);
        return this.sendMessage(messageId, builder.asUint8Array());
    }
    close() {
        if (this.webSocket) {
            this.webSocket.close();
        }
    }
}
exports.WebSocketConnection = WebSocketConnection;
//# sourceMappingURL=WebSocketConnection.js.map