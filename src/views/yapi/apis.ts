import axios, { AxiosInstance } from "axios";
import { commands, workspace } from "vscode";
import { getConfigKey } from "../../utils";

// 配置 key
export const configKeys = ['baseurl', 'email', 'password'];

// 获取配置
export const getYapiConfig = () => configKeys.map(key => getConfigKey(key));

// 校验配置是否不为空
export const isCheckYapi = () => getYapiConfig().filter(Boolean).length === configKeys.length;

/**
 * 登录判断装饰器
 * @param _target 
 * @param _propertyKey 
 * @param descriptor 
 */
function Logining(_target: any, _propertyKey: string, descriptor: any) {
    const origin = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        if (this.logining === false) {
            await this.login(this.email, this.password);
        }
        return origin.call(this, ...args);
    };
}

/**
 *  YAPI API
 */
class YapiApi {
    logining: boolean = false;
    url: string;
    email: string;
    password: string;
    http: AxiosInstance;

    constructor(url: string, email: string, password: string) {
        this.url = url;
        this.email = email;
        this.password = password;
        this.http = axios.create({
            baseURL: url
        });
        this.http.interceptors.response.use(
            res => res.data.errcode === 0 ? res.data.data : Promise.reject(res.data.errmsg),
            error => Promise.reject(error)
        );
    }

    // 登录
    async login(email: string, password: string) {
        const res = await axios.post('/api/user/login', { email, password }, { baseURL: this.url });
        this.http.defaults.headers["cookie"] = res.headers["set-cookie"]?.join(';') || "";
        this.logining = true;
    }

    /**
     * 获取分组
     * @returns 
     */
    @Logining
    async getGroupList(): Promise<GroupModel[]> {
        return this.http.get('/api/group/list');
    }

    /**
     * 获取项目列表
     * @param group_id 
     * @param page 
     * @param limit 
     * @returns 
     */
    @Logining
    async getProjectList(group_id: number, page: number, limit: number | string): Promise<ProjectModel[]> {
        return this.http.get(`/api/project/list?group_id=${group_id}&page=${page}&limit=${limit}`)
            .then((res: any) => res['list']);
    }

    /**
     * 获取项目下分类
     * @param project_id 
     */
    @Logining
    async getProjectCat(project_id: number): Promise<ProjectCatsModel[]> {
        return this.http.get(`/api/interface/list_menu?project_id=${project_id}`);
    };

    /**
     * 获取分类下接口列表
     * @param catid 分类 ID
     * @param page 
     * @param limit 
     * @returns 
     */
    @Logining
    async getInterfaceListCat(catid: number, page: number, limit: number | string): Promise<InterfaceModel[]> {
        return this.http.get(`/api/interface/list_cat?page=${page}&limit=${limit}&catid=${catid}`)
            .then((res: any) => res['list']);
    }

    /**
     * 获取项目下接口列表
     * @param project_id 
     * @param page 
     * @param limit 
     * @returns 
     */
    @Logining
    async getInterfaceList(project_id: number, page: number, limit: number | string): Promise<InterfaceModel[]> {
        return this.http.get(`/api/interface/list?project_id=${project_id}&page=${page}&limit=${limit}`)
            .then((res: any) => res['list']);
    }

    /**
     * 获取接口详情
     * @param id 
     * @returns 
     */
    @Logining
    async getInterface(id: number): Promise<InterfaceInfoModel> {
        return this.http.get(`/api/interface/get?id=${id}`);
    }

    /**
     * 接口查询
     * @param q 
     * @returns 
     */
    @Logining
    async search(q: string): Promise<SearchInterfaceModel['interface']> {
        return this.http.get(`/api/project/search?q=${q}`).then((res: any) => res.interface);
    }

    /**
     * 获取接口变更记录
     */
    @Logining
    async log(typeid: number | string, type: 'group' | 'project', page: number, limit: number | string = 20): Promise<ApiLog> {
        return this.http.get(`/api/log/list?typeid=${typeid}&type=${type}&page=${page}&limit=${limit}`);
    }
}

export let yapiApi = new YapiApi(<string>getConfigKey('baseurl'), <string>getConfigKey('email'), <string>getConfigKey('password'));

// 监听配置变化
export const watchConfig = (() => {
    let oldVal = getYapiConfig();

    return workspace.onDidChangeConfiguration(() => {
        const newVal = getYapiConfig();
        if (oldVal[0] !== newVal[0] || oldVal[1] !== newVal[1] || oldVal[2] !== newVal[2]) {
            oldVal = newVal;
            const isShow = isCheckYapi();
            commands.executeCommand('setContext', 'yapi-view.api-list.show', isShow);
            if (isShow) {
                yapiApi = new YapiApi(<string>getConfigKey('baseurl'), <string>getConfigKey('email'), <string>getConfigKey('password'));
            }
        }
    });
})();