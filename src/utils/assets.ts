import { Uri, extensions, workspace } from "vscode";

const _catchText: { [k: string]: string; } = {

};

/**
 * 读取静态资源文件
 * @param url 
 * @returns 
 */
export const getAssetsText = async (url: string) => {
    if (_catchText[url]) {
        return _catchText[url];
    }
    const extension = extensions.getExtension('mal.yapi-box');
    if (extension) {
        const path = Uri.joinPath(extension.extensionUri, 'assets', url);
        return workspace.fs.readFile(path).then(res => {
            _catchText[url] = res.toString();
            return _catchText[url];
        });
    }
    return '';
};
