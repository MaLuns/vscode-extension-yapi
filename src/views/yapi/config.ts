import { window, workspace } from "vscode";
import { formatDate, getWorkspaceFolder } from "../../utils";
import { getApiUrl } from "../../utils/to-type";

const defConfig = <IYapiConfig>{
    responseKey: 'data',
    genRequest({ comment, fnName, requestFnName, reqQueryTypeName, reqBodyTypeName, resBodyTypeName, apiPath, reqQueryType, reqBodyType, resBodyType }: IGenRequest) {
        const method = requestFnName.toLocaleLowerCase();

        // 返回是数组处
        if (resBodyType?.endsWith('[]')) {
            resBodyTypeName += '[]';
        }

        // 返回是基础类型处理
        if (resBodyType?.includes('declare')) {
            resBodyTypeName = resBodyType.split('=')[1].trim();
        }

        let params = ''; // api 方法参数
        let paramsData = '';// api 参数拼接
        if (method === 'get') {
            params = `${reqQueryType ? `params: ${reqQueryTypeName},` : ''}${reqBodyType ? `d ata: ${reqBodyTypeName},` : ''}`;
            paramsData = `, { ${reqQueryType ? 'params,' : ''}${reqBodyType ? ' data' : ''} }`;
        } else if (method === 'post') {
            params = `${reqQueryType ? `params: ${reqQueryTypeName},` : ''}${reqBodyType ? ` data: ${reqBodyTypeName},` : ''}`;
            paramsData = `, ${reqBodyType ? 'data' : 'undefined'}, {${reqQueryType ? ' params ' : ''}}`;
        }

        const reg = /({.*?})/g;
        if (reg.test(apiPath)) {
            apiPath = apiPath.replace(reg, (str) => {
                params += `${str.replace(/^{|}$/g, '')}: string,`;
                return "$" + str;
            });
        }
        params = params.replace(/,$/g, '');

        return `
${comment}
export const ${fnName} = (${params}) => {
  return request.${method}<any, API<${resBodyTypeName}>>(\`${apiPath}\`${paramsData})
}
`;
    },
    formatInterfaceComment(data: InterfaceInfoModel, subName: string) {
        return `\n\n/**
 * ${data.title}-${subName}
 */\n`;
    },
    formatApiComment(data: InterfaceInfoModel) {
        return `/**
 * ${data.title}
 * @url ${getApiUrl(data)}
 * @time ${formatDate(new Date().getTime(), 'YY-MM-DD hh:mm:ss')}
 */`;
    },
    genCode(requestContent?: string, reqQueryType?: string, reqBodyType?: string, resBodyType?: string) {
        if (resBodyType?.endsWith('[]')) {
            resBodyType = resBodyType.replace(/\[\]$/g, '');
        }

        if (resBodyType?.includes('declare')) {
            resBodyType = '';
        }

        return '' + requestContent + reqQueryType + reqBodyType + resBodyType;
    }
};

let _cache: IYapiConfig | undefined;

/**
 * 获取配置
 * @returns 
 */
export const getUserYapiConfig = async (): Promise<IYapiConfig> => {
    if (_cache) {
        return _cache;
    }
    const workspaceFolder = await getWorkspaceFolder();
    if (workspaceFolder) {
        const files = await workspace.findFiles('yapi.config.js', '**​/node_modules/**', 1);
        if (files.length > 0) {
            return workspace.fs.readFile(files[0]).then((res) => {
                try {
                    let config: IYapiConfig | undefined = new Function(res.toString())()?.();
                    _cache = config || defConfig;
                    return _cache;
                } catch (error) {
                    console.log('配置异常，请检查配置项', error);
                    window.showErrorMessage(`配置异常，请检查配置项 ${error}`);
                    return defConfig;
                }
            });
        }
    }
    return defConfig;
};

/**
 * 是否是 TS 项目
 * @returns 
 */
export const isTs = async () => {
    const workspaceFolder = await getWorkspaceFolder();
    if (workspaceFolder) {
        const files = await workspace.findFiles('tsconfig.json', '**​/node_modules/**', 1);
        return files.length > 0;
    } else {
        return true;
    }
};