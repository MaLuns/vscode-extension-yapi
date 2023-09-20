import { parse } from 'json5';
import { Disposable, QuickPickItem, RelativePattern, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri, WebviewPanel, commands, extensions, window, workspace } from "vscode";
import { yapiApi } from './apis';
import { manageMockServer } from "./server";
import { BaseTree, ViewNode } from "../basetree";
import { Output, formatDate, getConfigKey, getWorkspaceFolder, openFile } from "../../utils";
import { schema2Json } from "../../utils/schema";
import { getMockSchema, runJsonMock, runSchemaMock } from '../../utils/mock';
import { generateApiCode } from '../../utils/to-type';
import { getUserYapiConfig, isTs } from './config';
import WebViewManger from '../../webview';
import MultiStepInput from '../../utils/multi-step-input';
import ejs from '../../utils/easy-json-schema';
import diffView from '../../utils/diff-view';
import { getAssetsText } from '../../utils/assets';
import * as pug from 'pug';


type YapiModel = GroupModel | ProjectModel | InterfaceModel | ProjectCatsModel;

const clearLog = () => {
    if (getConfigKey('clearlog')) {
        Output.clear();
    } else {
        Output.appendLine('');
    }
};

/**
 * 获取返回数据
 * @param id 
 * @returns 
 */
const _getApiResponse = (id: number) => {
    return new Promise((resolve, reject) => {
        yapiApi.getInterface(id).then(res => {
            if (res.res_body_type === 'json' && res.res_body_is_json_schema) {
                try {
                    const data = schema2Json(parse(res.res_body), true);
                    resolve(data);
                } catch (error) {
                    resolve(null);
                }
            } else {
                try {

                    const data = schema2Json(ejs(parse(res.res_body)), true);
                    resolve(data);
                } catch (error) {
                    resolve(null);
                }
            }
        });
    });
};

/**
 * 生成 Mock Schema
 * @param data 
 * @returns 
 */
const _generateMockSchema = async (data: YapiItem) => {
    const wf = await getWorkspaceFolder();
    if (wf) {
        const item = <InterfaceModel>data.data!;
        const res = await _getApiResponse(item._id);
        if (res) {
            const schema = getMockSchema(res);
            return {
                id: item._id,
                projectid: item.project_id,
                title: item.title,
                path: item.path,
                method: item.method,
                schema
            };
        } else {
            window.showWarningMessage('数据转换失败');
        }
    } else {
        window.showWarningMessage('未打开项目, 请先打开项目');
    }
};

/**
 * 日志查询
 */
const queryLog = {
    typeid: <string | number>'',
    type: <'group' | 'project'>'project',
    offset: 0,
    catchData: <LogItem[]>[]
};


/**
 * Yapi 树节点
 */
class YapiItem extends ViewNode<YapiModel> {
    constructor(public data?: YapiModel | undefined, parent?: YapiItem) {
        super(parent);
    }

    getChildren(): YapiItem[] | Promise<YapiItem[]> {
        if (this.data) {
            if ("group_id" in this.data) {
                const showCat = getConfigKey<boolean>('showCat');
                if (showCat) {
                    // 分类
                    return yapiApi.getProjectCat(this.data._id).then(res => res.filter(item => item.list.length).map(item => new YapiItem(item, this)));
                } else {
                    // 接口
                    return yapiApi.getInterfaceList(this.data._id, 1, 'all').then(res => res.map(item => new YapiItem(item, this)));
                }
            } else if ('list' in this.data) {
                return this.data.list.map(item => new YapiItem(item, this));
            } else {
                // 项目
                return yapiApi.getProjectList(this.data._id, 1, 50).then(res => res.map(item => new YapiItem(item, this)));
            }
        } else {
            // 空间分组
            return yapiApi.getGroupList().then(res => res.map(item => new YapiItem(item, this)));
        }
    }

    getTreeItem(node: YapiItem): TreeItem | Promise<TreeItem> {
        if (node.data) {
            if ('list' in node.data) { // 分类
                const item = <ProjectCatsModel>node.data;
                const treeItem = new TreeItem(item.name, TreeItemCollapsibleState.Collapsed);
                treeItem.contextValue = "project_cat";
                treeItem.iconPath = new ThemeIcon('split-vertical');
                return treeItem;
            } else if ("project_id" in node.data) { // 接口
                const item = <InterfaceModel>node.data;
                const treeItem = new TreeItem(item.title, TreeItemCollapsibleState.None);
                treeItem.contextValue = "interface";
                treeItem.description = item.path;
                treeItem.iconPath = new ThemeIcon(item.status === 'done' ? 'pass-filled' : 'circle-large-outline');
                treeItem.resourceUri = Uri.parse(`yapi-box://method/status/${item.method}`);
                treeItem.tooltip = `${item.title} • ${item.path}`;
                treeItem.command = {
                    command: "yapi.cmd.view-interface",
                    title: "查看接口",
                    arguments: [item, node.parent]
                };
                return treeItem;
            } else if ("group_id" in node.data) { // 项目
                const item = <ProjectModel>node.data;
                const treeItem = new TreeItem(item.name, TreeItemCollapsibleState.Collapsed);
                treeItem.contextValue = "project";
                treeItem.iconPath = new ThemeIcon('project');
                return treeItem;
            } else { // 空间分组
                const item = <GroupModel>node.data;
                const treeItem = new TreeItem(item.group_name, TreeItemCollapsibleState.Collapsed);
                treeItem.contextValue = "group";
                treeItem.iconPath = new ThemeIcon('group-by-ref-type');
                return treeItem;
            }
        }
        return new TreeItem('Yapi List', TreeItemCollapsibleState.Collapsed);
    }
};

/**
 * Yapi Tree
 */
export class YapiTree extends BaseTree<YapiModel, YapiItem> {
    private catchApis: { [k: string | number]: InterfaceModel[]; } = {};

    protected registerCommands(): Disposable[] {
        return [
            commands.registerCommand('yapi.cmd.refresh', () => this.refresh()),
            commands.registerCommand('yapi.cmd.search', (i) => this.search(i)),
            commands.registerCommand('yapi.cmd.view-interface', this.viewInterface),
            commands.registerCommand('yapi.cmd.generate-mock-data', this.generateMockData),
            commands.registerCommand('yapi.cmd.generate-mock-schema', this.generateMockSchema),
            commands.registerCommand('yapi.cmd.create-mock-server', (i) => this.createMockServer(i)),
            commands.registerCommand('yapi.cmd.generate-api-code', this.generateApiCode),
            commands.registerCommand('yapi.cmd.generate-api-code-batch', this.generateApiCodeBatch),
            commands.registerCommand('yapi.cmd.query-log', (i) => this.queryLog(i))
        ];
    }

    protected getRoot(): YapiItem {
        return new YapiItem();
    }

    async getChildren(node?: YapiItem): Promise<YapiItem[]> {
        if (node) {
            const data = await node.getChildren();
            const showCat = getConfigKey<boolean>('showCat');

            if (node.data && "group_id" in node.data) {
                if (showCat) {
                    this.catchApis[node.data._id] = data.map(item => (<ProjectCatsModel>item.data).list).flat(1);
                } else {
                    this.catchApis[node.data._id] = data.map<InterfaceModel>(item => <InterfaceModel>item.data);
                }
            }

            return data;
        }
        const root = this.ensureRoot();
        return root?.getChildren() || [];
    }

    /**
     * 获取接口列表
     * @param projectId 
     * @returns 
     */
    getInterfaces(projectId: string | number) {
        return this.catchApis[projectId];
    }

    /**
     * 查询接口详情
     * @param item 
     */
    viewInterface(item: InterfaceModel, data?: YapiItem) {
        yapiApi.getInterface(item._id).then(res => {
            clearLog();
            Output.appendLine(`[接口名称]: ${res.title}`);
            if (data?.data) {
                if ('list' in data.data) {
                    Output.appendLine(`[接口分类]: ${data.data.name}`);
                }
            }
            Output.appendLine(`[接口路径]: ${res.path}`);
            Output.appendLine(`[接口类型]: ${res.method}`);
            Output.appendLine(`[创 建 人]: ${res.username.replace(' ', '')}`);
            Output.appendLine(`[接口状态]: ${res.status === 'done' ? '已完成' : '未完成'}`);
            Output.appendLine(`[更新时间]: ${formatDate(res.up_time * 1000)}`);
            Output.appendLine(`[文档地址]: ${getConfigKey<string>('baseurl')}/project/${res.project_id}/interface/api/${res._id}`);
            Output.appendLine('');

            //#region 请求数据格式化
            Output.appendLine('>>> 请求数据');
            const printData = (data: any[]) => {
                if (data && data.length) {
                    let query: { [k: string]: string; } = {};
                    data.map(item => {
                        query[item.name] = item.desc;
                    });
                    Output.appendLine(JSON.stringify(query, null, 2));
                }
            };

            if (res.req_params && res.req_params.length) {
                Output.appendLine('\n--- Url ---\n');
                const params: Record<string, any> = {};
                res.req_params.forEach(item => {
                    params[item.name] = item.desc;
                });
                Output.appendLine(JSON.stringify(params, null, 2));
            }

            if (res.req_query && res.req_query.length) {
                Output.appendLine('\n--- Query ---\n');
                printData(res.req_query);
            }

            // 输出参数格式 包含 数组-对象 描述信息
            const printBody = (body: any) => {
                const data = schema2Json(parse(body), false, true);
                Output.appendLine(JSON.stringify(data, null, 2).replace(/"\/\/(":)?(\s+")?(.*)"(,?)/g, '/* $3 */'));
            };

            if (res.req_body_type === 'form') {
                if (res.req_body_form && res.req_body_form.length) {
                    Output.appendLine(`\n--- Body-${res.req_body_type} ---\n`);
                    printData(res.req_body_form);
                }
            } else if (res.req_body_type === 'json') {
                if (res.req_body_other && res.req_body_is_json_schema) {
                    try {
                        Output.appendLine(`\n--- Body-${res.req_body_type} ---\n`);
                        printBody(res.req_body_other);
                    } catch (error) {
                        console.log(error);

                    }
                }
            } else {
                if (res.req_body_other) {
                    Output.appendLine(`\n--- Body-${res.req_body_type} ---\n`);
                    Output.appendLine(res.req_body_other);
                }
            }
            //#endregion

            Output.appendLine('');

            //#region 响应数据格式
            Output.appendLine('>>> 响应数据\n');
            if (res.res_body_type === 'json' && res.res_body_is_json_schema) {
                try {
                    printBody(res.res_body);
                } catch (error) {
                    console.log(error);
                }
            } else {
                Output.appendLine(res.res_body);
            }
            //#endregion

            Output.show(true);
        });
    }

    /**
     * 生成 Mock 数据格式
     * @param item 
     */
    async generateMockData(item: YapiItem) {
        const res = await _getApiResponse(item.data!._id);
        if (res) {
            clearLog();
            Output.show();
            Output.appendLine(JSON.stringify(runJsonMock(res), null, 2));
        }
    }

    /**
     * 生成 Mock Schema
     * @param item 
     */
    async generateMockSchema(data: YapiItem) {
        const schemaFile = await _generateMockSchema(data);
        if (!schemaFile) { return; };
        if (getConfigKey('mock.isSaveLocal')) {
            const wf = await getWorkspaceFolder();
            const directoryPath = getConfigKey<string>('mock.directory');
            const pattern = `${directoryPath}/${schemaFile?.projectid}/${schemaFile?.id}.json`;
            const mockUri = Uri.joinPath(wf!.uri, pattern);
            const [file] = await workspace.findFiles(pattern, '**​/node_modules/**', 1);

            const saveFile = async (uri: Uri, data: any, isOpen?: boolean) => {
                await workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2)));
                isOpen && openFile(uri);
            };

            // 文件已存在
            if (file) {
                const type = getConfigKey('mock.localStorageProcessing');
                switch (type) {
                    case "confirm":
                        window.showWarningMessage("文件已存在", "覆盖", "打开", "忽略").then(res => {
                            if (res === "覆盖") {
                                saveFile(mockUri, schemaFile, true);
                            } else if (res === "打开") {
                                openFile(mockUri);
                            }
                        });
                        break;
                    case "override":
                        saveFile(mockUri, schemaFile, true);
                        break;
                    case "open":
                        openFile(mockUri);
                        break;
                }
            } else {
                await workspace.fs.writeFile(mockUri, Buffer.from(JSON.stringify(schemaFile, null, 2)));
                getConfigKey('mock.openTheFileAfterTheBuild') && openFile(mockUri);
            }
        } else {
            clearLog();
            Output.show();
            Output.appendLine(JSON.stringify(schemaFile, null, 2));
        }
    }


    /**
     * 查询
     * @param data 
     */
    async search(data: YapiItem) {
        const { _id: id, name } = <ProjectModel>data.data;

        const pickBox = async (input: MultiStepInput, state: string) => {
            const q = state.trim();
            const apis = this.getInterfaces(id) || await yapiApi.getInterfaceList(id, 1, 'all') || [];
            const list = apis.filter(item => item.title.includes(q));

            const pick = await input.showQuickPick({
                title: `搜索到关于 [${q}] 有 ${list.length} 条`,
                step: 2,
                totalSteps: 2,
                placeholder: '',
                items: list.map<QuickPickItem>(item => {
                    return {
                        label: `$(${item.status === 'done' ? 'pass-filled' : 'circle-large-outline'}) ${item.title}`,
                        description: item.method,
                        detail: item.path,
                        _i: item
                    };
                }),
            });

            this.viewInterface((<any>pick)._i);
        };

        const inputBox = async (input: MultiStepInput) => {
            const res = await input.showInputBox({
                title: `搜索 ${name} 中接口`,
                step: 1,
                totalSteps: 2,
                placeholder: '请输入 Api 名称',
                prompt: '',
                validate: (v) => Promise.resolve(v.trim() === '' ? '请输入 Api 名称' : undefined),
                value: '',
            });
            return (input: MultiStepInput) => pickBox(input, <string>res);
        };

        MultiStepInput.run(input => inputBox(input));
    }

    /**
     * 生成 Api Code
     * @param data 
     */
    async generateApiCode(data: YapiItem) {
        try {
            const { _id: id } = <InterfaceModel>data.data;
            const res = await yapiApi.getInterface(id);
            const config = await getUserYapiConfig();
            const ts = await isTs();
            const code = generateApiCode(res, config);
            return workspace.openTextDocument({
                language: ts ? 'typescript' : 'javascript',
                content: ts ? config.genCode(code.requestContent, code.reqQueryType, code.reqBodyType, code.resBodyType) : (code.requestContent || '')
            }).then(docText => {
                return window.showTextDocument(docText, (window.activeTextEditor?.viewColumn || 0) + 1);
            });
        } catch (error) {
            window.showWarningMessage('代码生成失败\n' + error);
        }
    }

    /**
     * 批量生成 Api Code
     * @param data 
     */
    async generateApiCodeBatch(data: YapiItem) {
        const yapiItemList = await data.getChildren();
        const codes: [string[], string[]] = [[], []];
        const ts = await isTs();

        Promise.allSettled(yapiItemList.map(async item => {
            const { _id: id } = <InterfaceModel>item.data;
            const res = await yapiApi.getInterface(id);
            const config = await getUserYapiConfig();
            const code = generateApiCode(res, config);
            const text = ts ? config.genCode(code.requestContent, code.reqQueryType, code.reqBodyType, code.resBodyType) : (code.requestContent || '');
            codes[0].push(code.requestContent!.trim());
            codes[1].push(text.replace(code.requestContent!, '').trim());
        })).then(res => {
            const viewColumn = (window.activeTextEditor?.viewColumn || 0) + 1;

            const status = res.filter(item => item.status === 'fulfilled');
            window.showInformationMessage(`创建成功${status.length}条, 失败${res.length - status.length}条`);
            if (!ts) {
                codes.pop();
            }
            for (let index = 0; index < codes.length; index++) {
                workspace.openTextDocument({
                    language: ts ? 'typescript' : 'javascript',
                    content: codes[index].join('\n\n')
                }).then(docText => {
                    window.showTextDocument(docText, viewColumn);
                });
            }
        }).catch(e => {
            console.log(e);
        });
    }

    /**
     * 查看项目日志
     * @param data 
     */
    async queryLog(data: YapiItem) {
        if (data.data) {
            if ("group_id" in data.data) {
                queryLog.offset = 0;
                queryLog.type = 'project';
                queryLog.catchData = [];
                queryLog.typeid = data.data._id;
            } else {
                queryLog.offset = 0;
                queryLog.type = 'group';
                queryLog.catchData = [];
                queryLog.typeid = data.data._id;
            }

            commands.executeCommand('setContext', 'yapi-view.log.show', true);
            commands.executeCommand('yapi.cmd.log-load-more');
        }
    }

    /**
     * 创建 Mock 服务
     * @param data 
     */
    createMockServer(data: YapiItem) {
        const item = <ProjectModel>data.data;
        const { _id: id, name } = item;

        const project = {
            id: id.toString(),
            title: name,
            desc: '',
            port: getConfigKey<number>('mock.port') || 9000
        };

        manageMockServer.create(project, async (mockServer) => {
            mockServer.use(async (req, res) => {
                const { mockRoute, method } = req;
                res.writeHead(200, {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "X-Requested-With",
                    "Access-Control-Allow-Methods": "PUT,POST,GET,DELETE,OPTIONS",
                    'Content-Type': 'application/json'
                });

                // 存在注册路由
                if (mockRoute.schema) {
                    if (mockRoute.method && method && method.toLocaleLowerCase() !== mockRoute.method.toLocaleLowerCase()) {
                        res.end(`${mockRoute.path} 是 ${mockRoute.method} 类型, 当前请求为 ${method}`);
                        return;
                    }
                    res.end(JSON.stringify(runSchemaMock(mockRoute.schema)), "utf-8");
                    return;
                };

                // 获取 Api 详情
                const apis = (this.getInterfaces(id) || []);
                const api = apis.find((item) => item.path === mockRoute.path);
                if (api) {
                    if (api.method && method && method.toLocaleLowerCase() !== api.method.toLocaleLowerCase()) {
                        res.end(`${mockRoute.path} 是 ${api.method} 类型, 当前请求为 ${method}`);
                        return;
                    }
                    res.end(JSON.stringify(runJsonMock(await _getApiResponse(api._id))), "utf-8");
                    return;
                }

                // 首页展示所有 Api
                if (req.mockRoute.path === '') {
                    res.writeHead(200, { 'Context-Type': 'text/html' });
                    res.write('<head><meta charset="utf-8"/></head>');
                    res.end(apis.map(item => `<a href="${item.path}"><b>[${item.method}]</b> ${item.title}</a><br>`).join(''));
                    return;
                }

                res.end(`Not Found ${method} ${mockRoute.path}`);
            });

            this.getChildren(data);
            commands.executeCommand('setContext', 'yapi-view.mock-server.show', manageMockServer.hasServer());
            commands.executeCommand('yapi.cmd.server-refresh');
            // 监听本地 mock json
            if (workspace.workspaceFolders) {
                const directoryPath = getConfigKey<string>('mock.directory');
                const pattern = new RelativePattern(workspace.workspaceFolders[0].uri, `${directoryPath}/${id}/*.json`);
                mockServer.startWatch(pattern);
            }
        });
    }
}

/**
 * Mock 树节点
 */
class ServerItem extends ViewNode<ServerInfo>{
    constructor(public data?: ServerInfo | undefined, parent?: ServerItem) {
        super(parent);
    }

    getChildren(): ViewNode<ServerInfo>[] | Promise<ServerItem[]> {
        const servers = manageMockServer.getServers();
        return servers.map(item => new ServerItem(item, this));
    }

    getTreeItem(node: ServerItem): TreeItem | Promise<TreeItem> {
        if (node.data) {
            const item = node.data;
            const treeItem = new TreeItem(item.title || "", TreeItemCollapsibleState.None);
            treeItem.iconPath = new ThemeIcon("vm-running");
            treeItem.description = `${item.desc} ${item.port}`;
            treeItem.tooltip = '';
            treeItem.contextValue = 'mock-server';
            treeItem.command = {
                command: "vscode.open",
                title: "查看 Mock 服务",
                arguments: [`http://localhost:${item.port}`]
            };
            return treeItem;
        }
        return new TreeItem('Mock Server', TreeItemCollapsibleState.Collapsed);
    }
}

/**
 * Mock server treeview
 */
export class ServerTree extends BaseTree<ServerInfo, ServerItem> {
    protected registerCommands(): Disposable[] {
        return [
            commands.registerCommand('yapi.cmd.stop-mock-server', (item: ServerItem) => {
                if (item.data) {
                    manageMockServer.stop(item.data.id).then(() => {
                        this.refresh();
                        commands.executeCommand('setContext', 'yapi-view.mock-server.show', manageMockServer.hasServer());
                    });
                }
            }),
            commands.registerCommand('yapi.cmd.server-refresh', () => {
                this.refresh();
            })
        ];
    }

    protected getRoot() {
        return new ServerItem();
    }
}

/**
 * log tree item
 */
class LogItem extends ViewNode<Partial<ApiLogItem>>{

    constructor(public data: Partial<ApiLogItem> | undefined, public parent?: LogItem) {
        super(parent);
    }

    async getChildren(): Promise<ViewNode<Partial<ApiLogItem>>[]> {
        const data = await yapiApi.log(queryLog.typeid, queryLog.type, ++queryLog.offset).then(res => {
            return res.list.map(item => {
                item.nodeType = 'DataItem';
                return new LogItem(item, this);
            });
        });
        queryLog.catchData.push(...data);
        if (data.length < 20) {
            return [...queryLog.catchData];
        } else {
            return [
                ...queryLog.catchData,
                new LogItem({ nodeType: 'LoadMore', content: '查看更多' }, this)
            ];
        }
    }

    getTreeItem(node: LogItem): TreeItem | Promise<TreeItem> {
        if (node.data) {
            const context = node.data.content!.replace(/<[a-z].*?>|<\/[a-z]>|\n|\s/g, '');
            const treeItem = new TreeItem(context, TreeItemCollapsibleState.None);
            treeItem.iconPath = new ThemeIcon('git-commit');

            if (node.data.nodeType === 'LoadMore') {
                treeItem.iconPath = new ThemeIcon('more');
                treeItem.command = {
                    title: "查看更多",
                    command: "yapi.cmd.log-load-more",
                    arguments: [node],
                };
            }

            if (node.data.nodeType === 'DataItem') {
                treeItem.tooltip = `${context}`;
                treeItem.command = {
                    title: '改动详情',
                    command: "yapi.cmd.log-diff-view",
                    arguments: [node],
                };
                if (/添加了/.test(context)) {
                    treeItem.resourceUri = Uri.parse(`yapi-box://log/add`);
                }
                if (/更新了/.test(context)) {
                    treeItem.resourceUri = Uri.parse(`yapi-box://log/update`);
                }
                if (/删除了/.test(context)) {
                    treeItem.resourceUri = Uri.parse(`yapi-box://log/delete`);
                }
            }

            return treeItem;
        }
        return new TreeItem('LogTree', TreeItemCollapsibleState.Expanded);
    }
}

/**
 * log treeview
 */
export class LogTree extends BaseTree<ApiLogItem, LogItem>{
    protected registerCommands(): Disposable[] {
        return [
            commands.registerCommand('yapi.cmd.log-load-more', () => this.refresh()),
            commands.registerCommand('yapi.cmd.log-diff-view', async (data: LogItem) => {
                if (data.data?.data) {
                    const diffViewCss = await getAssetsText('template/diffview/index.css');
                    const diffViewHtml = await getAssetsText('template/diffview/index.pug');
                    const html = pug.render(diffViewHtml, {
                        dataList: diffView(data.data?.data),
                        style: diffViewCss
                    });
                    const { panel, type } = WebViewManger.createOrUpdateWebView('yapi.logo', 'Api 改动日志', html);
                    if (type === 'add') {
                        const extension = extensions.getExtension('mal.yapi-box');
                        if (extension) {
                            panel.iconPath = Uri.joinPath(extension.extensionUri, 'assets', 'icon128x128.png');
                        }
                    }
                }
            })
        ];
    }

    protected getRoot(): LogItem {
        return new LogItem(undefined);
    }
}