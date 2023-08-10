import { ConfigurationTarget, Uri, commands, window, workspace } from "vscode";

/**
 * 输出面板
 */
export const Output = window.createOutputChannel('Yapi output', 'yapi-output');

/**
 * 格式化时间
 * @param time 
 * @param format 
 * @param isprefix 
 * @returns 
 */
export const formatDate = (time: number | string, format = 'YY-MM-DD hh:mm:ss') => {
    const date = new Date(time);
    const year = date.getFullYear(),
        month = date.getMonth() + 1, //月份是从0开始的
        day = date.getDate(),
        hour = date.getHours(),
        min = date.getMinutes(),
        sec = date.getSeconds();

    const newTime = format.replace(/YY/g, year.toString())
        .replace(/MM/g, month.toString().padStart(2, '0'))
        .replace(/DD/g, day.toString().padStart(2, '0'))
        .replace(/hh/g, hour.toString().padStart(2, '0'))
        .replace(/mm/g, min.toString().padStart(2, '0'))
        .replace(/ss/g, sec.toString().padStart(2, '0'));

    return newTime;
};

/**
 * 格式化 
 * @param time 
 */
export const formatTime = (time: number) => {
    const _hour = 1000 * 60 * 60;
    const _min = 1000 * 60;
    const hour = (time / _hour).toFixed(0);
    const min = ((time % _hour) / _min).toFixed(0);
    return `${hour}"${min}`;
};

// 缓存配置
let _cacheConfig: { [k: string]: any; } = {};

/**
 * 获取配置
 * @param key 
 * @param 
 * @returns 
 */
export const getConfigKey = <T>(key: string): T | undefined => {
    if (_cacheConfig[key] !== undefined) {
        return _cacheConfig[key];
    }
    const val = workspace.getConfiguration('yapi').get<T>(key);
    _cacheConfig[key] = val;
    return val;
};

/***
 * 更新配置
 */
export const updateConfigKey = (section: string, value: any, configurationTarget?: ConfigurationTarget | boolean | null, overrideInLanguage?: boolean) => {
    workspace.getConfiguration('yapi').update(section, value, configurationTarget, overrideInLanguage);
    _cacheConfig[section] = value;
};

/**
 *  清除缓存配置
 * @returns 
 */
export const clearCacheConfig = () => _cacheConfig = {};

/**
 * 是否是普通对象
 * @param value 
 */
export const isPlainObject = (v: any): boolean => !!v && typeof v === 'object' && (v.__proto__ === null || v.__proto__ === Object.prototype);

/**
 * 判断是否为字符串
 * @param value 
 * @returns 
 */
export const isString = (value: any): boolean => Object.prototype.toString.call(value) === '[object String]';

/**
 * 返回给定的uri属于的 workspaceFolder 索引
 *
 * @export
 * @param {Uri} uri
 * @returns {(number | undefined)}
 */
export const getIndexOfWorkspaceFolder = (uri: Uri): number | undefined => {
    const ws = workspace.getWorkspaceFolder(uri);
    return ws ? ws.index : undefined;
};

/**
 * 格式化字符串
 * @param str 
 * @param vals 
 * @returns 
 */
export const formatStr = (str: string, ...vals: string[]): string => vals.reduce((s, v, i) => s.replace(new RegExp('\\{' + i + '\\}', 'g'), v), str);

/**
 * 获取工作目录
 */
export const getWorkspaceFolder = async () => {
    const ws = workspace.workspaceFolders;
    if (ws) {
        if (ws.length === 1) {
            return ws[0];
        } else {
            const result = await window.showQuickPick(
                ws.map(item => {
                    return {
                        label: item.name,
                        index: item.index
                    };
                }),
                {
                    placeHolder: "选择工作目录"
                }
            );
            if (result) {
                return ws[result.index];
            }
        }
    }
    return null;
};

/**
 * 打开文件 || 链接
 * @param uri 
 */
export const openFile = (uri: Uri) => commands.executeCommand('vscode.open', uri);

/**
 * 查找工作目录文件
 * @param paths 
 * @returns 
 */
export const findWorkspaceFile = async (paths: string[]) => {
    const getFile = (path: string) => workspace.findFiles(path, '**​/node_modules/**', 1);
    for (let index = 0; index < paths.length; index++) {
        const path = paths[index];
        const [file] = await getFile(path);
        if (file) {
            return file;
        }
    }
};

/**
 * 获取选中文本
 * @returns 
 */
export const getCurrentText = () => {
    const currentEditor = window.activeTextEditor;
    return currentEditor?.document.getText(currentEditor.selection);
};