
interface IYapiConfig {
    /**
     * 生成 res 包含的属性，默认 all, 可指定为 data
     */
    responseKey: string;
    /**
     * 生成函数
     * @param t 
     */
    genRequest(t: IGenRequest): string;
    /**
     * 生成接口类型注释
     * @param t 
     * @param s 
     */
    formatInterfaceComment(t: InterfaceInfoModel, s: string): string;
    /**
     * 生成 Http 方法注释
     * @param t 
     */
    formatApiComment(t: InterfaceInfoModel): string;
    /**
     * 生成代码片段
     * @param requestContent 
     * @param reqQueryType 
     * @param reqBodyForm 
     * @param reqBodyType 
     * @param resBodyType 
     */
    genCode(requestContent?: string, reqQueryType?: string, reqBodyForm?: string, reqBodyType?: string, resBodyType?: string): string;
}

interface IGenRequest {
    /**
     * 函数名
     */
    fnName: string;
    /**
     * 注释
     */
    comment: string;
    /**
     * 入参 Query 类型
     */
    reqQueryType?: string;
    /**
     *  入参 Query 类型名称
     */
    reqQueryTypeName: string;
    /**
     * 入参 Body | From 类型
     */
    reqBodyType?: string;
    /**
     * 入参类型名称
     */
    reqBodyTypeName: string;
    /**
     * 出参类型
     */
    resBodyType?: string;
    /**
     * 出参类型名称
     */
    resBodyTypeName: string;
    /**
     * 方法类型
     */
    requestFnName: 'GET' | 'POST' | 'DELETE' | 'PUT';
    /**
     * api 地址
     */
    apiPath: string;
}

/**
 * 空间
 */
interface GroupModel {
    _id: number;
    add_time: number;
    group_name: string;
    role: string;
    type: string;
    up_time: number;
}

/**
 * 项目
 */
interface ProjectModel {
    _id: number,
    switch_notice: boolean,
    name: string,
    basepath: string,
    project_type: string,
    uid: number,
    group_id: number,
    icon: string,
    color: string,
    add_time: number,
    up_time: number,
    env: any[],
    follow: boolean;
}

/**
 * 项目分类
 */
interface ProjectCatsModel {
    _id: number;
    __v: number;
    add_time: number;
    desc: string;
    index: number;
    name: string;
    project_id: number;
    uid: number;
    up_time: number;
    list: InterfaceModel[];
}

/**
 * 接口列表
 */
interface InterfaceModel {
    _id: number,
    edit_uid: number,
    status: string,
    api_opened: false,
    tag: string[],
    method: string,
    title: string,
    path: string,
    project_id: number,
    catid: number,
    uid: number,
    add_time: number;
}

/**
 * 接口详情
 */
interface InterfaceInfoModel {
    query_path: Array<{
        path: string;
        params: any[];
    }>;
    edit_uid: number;
    status: string;
    type: string;
    api_opened: boolean;
    index: number;
    tag: string[];
    _id: number;
    method: "GET" | "POST" | "PUT" | "DELETE";
    title: string;
    path: string;
    req_body_is_json_schema: boolean;
    req_params: any[];
    req_body_form: any[];
    req_body_other: string;
    req_body_type: 'raw' | 'form' | 'json';
    req_headers: Array<{
        path: string;
        params: any[];
    }>;
    req_query: Array<{
        _id: string;
        required: string;
        type?: string;
        name: string;
        desc: string;
    }>;
    res_body_type: 'json' | 'raw';
    res_body_is_json_schema: boolean;
    res_body: string;
    project_id: number;
    catid: number;
    uid: number;
    add_time: number;
    up_time: number;
    __v: number;
    desc: string;
    markdown: string;
    username: string;
}

/**
 * 查询列表
 */
interface SearchInterfaceModel {
    interface: {
        _id: number;
        addTime: number;
        projectId: number;
        uid: number;
        upTime: number;
        title: string;
    }[];
}

/**
 * 变更日志
 */
interface ApiLog {
    /**
     * 总数
     */
    total: number;
    /**
     * 列表
     */
    list: ApiLogItem[];
}

interface ApiLogItem {
    /**
     * id
     */
    _id: number,
    /**
     * 类型
     */
    type: string,
    /**
     * 更新文案 (HTML 字符串)
     */
    content: string,
    /**
     * 
     */
    uid: number,
    /**
     * 操作人
     */
    username: string,
    /**
     * 
     */
    typeid: number,
    /**
     * 更新时间
     */
    add_time: number,
    /**
     * 
     */
    __v: number;
    /**
     * 变更内容信息
     */
    data?: unknown;
    /** 树节点类型 */
    nodeType?: string;
}

/**
 * 服务描述
 */
interface ServerInfo {
    /**
     * 服务 ID
     */
    id: string,
    /**
     * 服务标题
     */
    title: string;
    /**
     * 服务描述
     */
    desc: string;
    /**
     * 服务端口
     */
    port: number;
}

/**
 * 本地 Mock schema 路由
 */
interface Route {
    /**
     * 标题
     */
    title: string;
    /**
     * Api 路由地址
     */
    path: string;
    /**
     * 文件物理路径
    */
    file_path: string;
    /**
     * 请求 method
     */
    method: string;
    /**
     * Mock 模板
     */
    schema?: any;
}