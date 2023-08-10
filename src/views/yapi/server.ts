import { IncomingMessage, Server, ServerResponse, createServer } from "http";
import { AddressInfo, Socket, createServer as createNetServer } from "net";
import { FileSystemWatcher, GlobPattern, Uri, window, workspace } from "vscode";
import { isString } from "../../utils";

type Request = IncomingMessage & { mockRoute: Route;[k: string]: any; };
type Response = ServerResponse;

/**
 * 中间件类型
 */
type MiddlewareHandle = (req: Request, res: Response, next: Function) => void;

/**
 * Mock 服务
 */
class MockServer {
    info: ServerInfo;

    server: Server<typeof IncomingMessage, typeof ServerResponse>;
    routes: { [key: string]: Route; } = {};

    private stacks: { path?: string; handle: Function; }[] = [];
    private sockets: Socket[] = [];
    private watcher?: FileSystemWatcher;

    constructor(info: ServerInfo, server: Server<typeof IncomingMessage, typeof ServerResponse>) {
        this.info = info;
        this.server = server;
        this.init();
    };

    private init() {
        this.server.on("connection", (socket) => {
            this.sockets.push(socket);
            socket.once("close", () => {
                this.removeSocket(socket);
            });
        });
    }

    /**
     * 注册中间件
     * @param path 
     * @param handle 
     */
    use(path: string | MiddlewareHandle, handle?: MiddlewareHandle) {
        if (isString(path)) {
            handle && this.stacks.push({
                path: <string>path,
                handle
            });
        } else {
            this.stacks.push({
                handle: <MiddlewareHandle>path
            });
        }
    }

    /**
     * 处理
     */
    _handle(req: Request, res: Response) {
        res.once("finish", () => {
            req.socket.destroy();
            this.removeSocket(req.socket);
        });

        let { url } = req;
        if (url) {
            url = url.split('?')[0].replace(/\/$/, '');
            const stacks = this.stacks.filter(item => (!item.path || item.path === url));
            const route = this.routes[url] || {};
            route.path = url;
            req.mockRoute = route;

            const next = () => {
                const middleware = stacks.shift();
                if (middleware) {
                    middleware.handle(req, res, next);
                } else {
                    res.end();
                }
            };

            // 中间件执行
            next();
        } else {
            res.end('Hello Yapi Box');
        }
    }

    /**
     * 移除缓存 socket
     * @param socket 
     */
    removeSocket(socket: Socket) {
        this.sockets = this.sockets.filter(s => s !== socket);
    }

    /**
     * 移除路由
     * @param uri 
     */
    removeRoute(uri: string | Uri) {
        if (typeof uri === 'string') {
            delete this.routes[uri];
        } else {
            const file_path = uri.fsPath;
            const route = Object.values(this.routes).find(item => item.file_path === file_path);
            route && delete this.routes[route.path];
        }
    }

    /**
     * 添加路由
     * @param uri 
     */
    async addRoute(uri: Uri) {
        const route = await this._getSchema(uri);
        if (route) {
            route.file_path = uri.fsPath;
            this.routes[route.path] = route;
        }
    }

    /**
     * 监听资源文件变动
     * @param globPattern 
     */
    startWatch(globPattern: GlobPattern) {
        workspace.findFiles(globPattern).then(files => {
            files.map((uri) => {
                this.addRoute(uri);
            });
        });

        if (!this.watcher) {
            this.watcher = workspace.createFileSystemWatcher(globPattern);
            this.watcher.onDidChange((uri) => this.addRoute(uri));
            this.watcher.onDidCreate((uri) => this.addRoute(uri));
            this.watcher.onDidDelete((uri) => this.removeRoute(uri));
        }
    }

    private async _getSchema(uri: Uri) {
        const text = await workspace.fs.readFile(uri);
        try {
            const obj = JSON.parse(text.toString());
            obj._url = uri.path;
            return obj;
        } catch (error) {
            return undefined;
        }
    }

    /**
     * 停止监听
     */
    stopWatch() {
        this.watcher?.dispose();
        this.watcher = undefined;
    }

    /**
     * 释放服务资源
     */
    dispose() {
        return new Promise((resolve) => {
            this.stopWatch();
            this.sockets.forEach((client => {
                client.destroy();
            }));
            this.server.close(resolve);
        });
    }
}

/**
 *  Mock 服务管理
 */
class ManageMockServer {
    private servers: { [k: string]: MockServer; } = {};

    /**
     * 返回一个可用端口
     * @param port 
     * @returns 
     */
    usePort(port = 0): Promise<number | undefined> {
        const canUse = async (p: number): Promise<number | undefined> => {
            if (p < 65535) {
                return await new Promise(res => {
                    try {
                        const srv = createNetServer();
                        srv.listen(p, () => {
                            const port = (<AddressInfo>(srv.address()!)).port;
                            srv.close(() => {
                                res(port);
                            });
                        });
                        srv.on("error", (e) => res(canUse(p + 1)));
                    } catch (error) {
                        res(canUse(p + 1));
                    }
                });
            }
        };
        return canUse(port);
    };

    /**
     * 创建 Mock 服务
     * @param param 
     * @param cb 创建成功
     */
    async create(info: ServerInfo, cb?: (ctx: MockServer) => void) {
        if (this.servers[info.id]) {
            window.showErrorMessage('服务已存在...');
        } else {
            const p = await this.usePort(info.port);
            if (p) {
                info.port = p;
                const server = createServer();
                const mockServer = new MockServer(info, server);
                server.listen(p, () => cb && cb(mockServer));
                server.on("request", mockServer._handle.bind(mockServer));
                this.servers[info.id] = mockServer;
            } else {
                window.showErrorMessage('未找到可用端口...');
            }
        }
    }

    /**
     * 停止服务
     * @param id 
     */
    stop(id: string) {
        return new Promise<void>((resolve) => {
            if (this.servers[id]) {
                const server = this.servers[id];
                server.dispose().then(() => {
                    delete this.servers[id];
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * 停止所有服务
     * @param id 
     */
    stopAll() {
        return new Promise<void>((resolve) => {
            Promise.all(Object.keys(this.servers).map(id => {
                return new Promise<void>(() => this.stop(id));
            })).then(() => {
                resolve();
            });
        });
    }

    /**
     * 获取服务列表
     * @returns 
     */
    getServers(): ServerInfo[] {
        return Object.values(this.servers).map(item => item.info);
    }

    /**
     * 是否有服务运行
     * @returns 
     */
    hasServer() {
        return Object.values(this.servers).length > 0;
    }
}

export const manageMockServer = new ManageMockServer();