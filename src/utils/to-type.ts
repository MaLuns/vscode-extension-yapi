import { parse } from 'json5';
import { isString } from '.';

/**
 * @description 对数据进一步抽象，分析json语法树
 */

/** 请求体类型 */
type ReqBody = ResObjectBody;

/** 返回对象类型 */
interface ResObjectBody {
    type: `${YapiDataType.Object}`;
    properties: Record<string, AllTypeNode>;
    title?: string;
    description?: string;
    required?: string[];
}

/** 返回数组类型 */
interface ResArrayBody {
    type: `${YapiDataType.Array}`;
    items: ResObjectBody;
    description?: string;
    required?: string[];
}

/**json抽象语法树的节点 */
type AllTypeNode =
    | {
        type: `${| YapiDataType.Number
        | YapiDataType.Integer
        | YapiDataType.String
        | YapiDataType.Boolean
        | YapiDataType.Null
        | YapiDataType.Long}`;
        description?: string;
        required?: string;
    }
    | ResObjectBody
    | ResArrayBody;

/** 请求query参数 */
type ReqQuery = {
    required: string;
    _id: string;
    name: string;
    desc: string;
}[];

const enum YapiDataType {
    Array = 'array',
    Boolean = 'boolean',
    Integer = 'integer',
    Null = 'null',
    Number = 'number',
    Object = 'object',
    String = 'string',
    Long = 'long'
}

const YapiTypeMapBasicTsType = {
    [YapiDataType.Boolean]: 'boolean',
    [YapiDataType.Integer]: 'number',
    [YapiDataType.Null]: 'null',
    [YapiDataType.Number]: 'number',
    [YapiDataType.String]: 'string',
    [YapiDataType.Long]: 'string | number'
};

const YapiTypeMapTsType = {
    ...YapiTypeMapBasicTsType,
    [YapiDataType.Array]: '[]',
    [YapiDataType.Object]: 'Record<string, any>'
};

const isBasicType = (type: string) => {
    const basicTypeList: string[] = [
        YapiDataType.Boolean,
        YapiDataType.Integer,
        YapiDataType.Null,
        YapiDataType.Number,
        YapiDataType.String,
        YapiDataType.Long
    ];
    return basicTypeList.includes(type);
};

/**
 * 首字母大写
 * @param word 
 * @param suffix 
 * @returns 
 */
const firstCharUpperCase = (word: string, suffix = '') => word ? (word[0].toUpperCase() + word.slice(1) + suffix).replace(/-_/g, '') : '';

/**
 * 格式化注释
 * @param comment 
 * @param tabCount 
 * @returns 
 */
const formatComment = (comment: string | undefined, tabCount = 0) => comment ? `\n${formatTabSpace(tabCount + 1)}/** ${comment} */` : '';

/**
 * 格式化tab
 * @param tabCount 
 * @returns 
 */
const formatTabSpace = (tabCount: number) => '  '.repeat(tabCount);

/**
 * GET 请求参数转化 typescript interface
 * @param typeName 
 * @param queryList 
 * @returns 
 */
const reqQuery2type = (typeName: string, queryList: ReqQuery, suffix = '') => {
    return `interface ${firstCharUpperCase(typeName, suffix)} {${queryList
        .map((query) => {
            const linkSymbol = query.required === '0' ? '?: ' : ': ';
            return `${formatComment(query.desc || '')}\n${formatTabSpace(1)}${query.name
                }${linkSymbol}string;`;
        })
        .join('')}\n}`;
};

/**
 * 生成对应的内容
 * @param node
 * @param tabCount
 * @param hadAddTabCount
 * @returns
 */
const getTypeNode = (node: AllTypeNode, tabCount = 0, hadAddTabCount = false): string => {
    if (Array.isArray(node.type)) {
        //@ts-ignore // fix: type 存在多个类型, 兼容处理
        node.type = node.type.map(item => YapiTypeMapTsType[item] || 'any').join('|');
    } else {
        node.type = node.type.toLowerCase() as `${YapiDataType}`;
    }

    if (isBasicType(node.type)) {
        return YapiTypeMapTsType[node.type] || 'any';
    } else if (YapiDataType.Object === node.type) {
        if (!node.properties) {
            return '{}';
        }
        let result = '{';
        for (const [key, value] of Object.entries(node.properties)) {
            result += `${formatComment(
                value.description,
                tabCount
            )}\n${formatTabSpace(tabCount + 1)}${encodeKey(key)}${(value.required || node.required)?.includes(key) ? ': ' : '?: '
                }${getTypeNode(value, tabCount + 1, true)}`;
        }
        result += `\n${formatTabSpace(tabCount)}}`;
        return result;
    } else if (YapiDataType.Array === node.type) {
        return getTypeNode(node.items, tabCount + (hadAddTabCount ? 0 : 1)).replace(/\n$/g, '') + YapiTypeMapTsType[YapiDataType.Array];
        //return `Array<${getTypeNode(node.items, tabCount + (hadAddTabCount ? 0 : 1))}>`; // YapiTypeMapTsType[YapiDataType.Array]
    } else if (isString(node.type)) {
        return node.type;
    }
    return '';
};

/**
 * POST 请求体转化 typescript interface
 * @param typeName 
 * @param resBody 
 * @param suffix 
 * @returns 
 */
const resBody2type = (typeName: string, resBody: AllTypeNode, suffix = '') => {
    const typeNode = getTypeNode(resBody);
    if (isBasicType(typeNode) || isBasicType(typeNode.replace(/\[\]$/g, ''))) {
        return `declare type ${firstCharUpperCase(typeName, suffix)} =  ${typeNode}`;
    } else {
        return `interface ${firstCharUpperCase(typeName, suffix)} ${typeNode}`;
    }
};

/**
 * POST 响应体转化 typescript interface
 * @param typeName 
 * @param reqBody 
 * @returns 
 */
const reqBody2type = (typeName: string, reqBody: ReqBody, suffix = '') => resBody2type(typeName, reqBody, suffix);

/**
 * key转义
 * @param key 
 * @returns 
 */
const encodeKey = (key: string) => encodeURIComponent(key) === key ? key : `"${key}""`;

/**
 * 解析JSON, 包含解析非标准的 json, e.g.: "{a:1}"
 * @param content 内容
 * @returns 对象
 */
const parseJson = (content: string) => {
    if (!content) {
        return {};
    }

    function convertStringToObj(str: string) {
        return new Function('return ' + str)();
    }

    try {
        const data = parse(content);
        return typeof data === 'string' ? convertStringToObj(content) : data;
    } catch (error) {
        return convertStringToObj(content);
    }
};

/**
 * 格式化顶部的注释说明
 * @param data 
 * @param subName 
 * @returns 
 */
const _formatInterfaceComment = (data: InterfaceInfoModel, subName: string) => {
    return `\n/**
 * ${data.title}-${subName}
 */\n`;
};

/**
 * 获取接口名称
 * @param data 
 * @returns 
 */
export const getApiName = (data: InterfaceInfoModel) => {
    const paths = data?.path?.split(/[/.]/g) || [];
    const lastWord = paths[paths.length - 1].replace(/[{}]/g, '');
    const preLastWord = paths[paths.length - 2].replace(/[{}]/g, '');
    return preLastWord + firstCharUpperCase(lastWord);
};

/**
 * 获取接口文档路径
 * @param data 
 * @returns 
 */
export const getApiUrl = (data: InterfaceInfoModel) => (`/project/${data.project_id}/interface/api/${data._id}`);

/**
 * 获取数据 
 * @param paths 
 * @param data 
 * @returns 
 */
export const getPaths = (paths: string, data: any) => paths.split('.').reduce((pre, cur) => (pre?.properties[cur] || pre), data);

/**
 * 生成 Api 代码
 * @param data 
 */
export const generateApiCode = (data: InterfaceInfoModel, config: Partial<IYapiConfig> = {}) => {
    const reqQuerySuffix = 'Query';
    const reqSuffix = 'Params';
    const resSuffix = 'Res';
    const interfaceName = getApiName(data);

    const formatInterfaceComment = config.formatInterfaceComment || _formatInterfaceComment;
    const reqComment = formatInterfaceComment(data, ' - 入参');
    const resComment = formatInterfaceComment(data, ' - 出参');

    // 入参
    const reqQueryType = data?.req_query?.length ? reqComment + reqQuery2type(interfaceName, data.req_query, reqQuerySuffix) : '';
    let reqBodyType: string = '';
    if (data.req_body_type === 'form') {
        reqBodyType = data?.req_body_form?.length ? reqComment + reqQuery2type(interfaceName, data.req_body_form, reqSuffix) : '';
    }
    if (data.req_body_type === 'json') {
        reqBodyType = data.req_body_other ? reqComment + reqBody2type(interfaceName, parseJson(data.req_body_other), reqSuffix) : '';
    }

    // 出参
    let resBodyType: string;
    if (config.responseKey === 'all') {
        resBodyType = data.res_body ? resComment + resBody2type(interfaceName, parseJson(data.res_body), resSuffix) : '';
    } else {
        resBodyType = data.res_body ? resComment + resBody2type(interfaceName, getPaths(config.responseKey || 'data', parseJson(data.res_body)), resSuffix) : '';
    }

    const comment = config?.formatApiComment && config.formatApiComment(data) || '';

    let requestContent = '';
    if (config.genRequest) {
        requestContent = config.genRequest({
            fnName: interfaceName,
            comment: comment,
            reqQueryType,
            reqQueryTypeName: firstCharUpperCase(interfaceName, reqQuerySuffix),
            reqBodyType: reqBodyType,
            reqBodyTypeName: firstCharUpperCase(interfaceName, reqSuffix),
            resBodyType,
            resBodyTypeName: firstCharUpperCase(interfaceName, resSuffix),
            requestFnName: data.method,
            apiPath: data.path
        });
    }

    return {
        reqQueryType,
        reqBodyType,
        resBodyType,
        requestContent
    };
};

