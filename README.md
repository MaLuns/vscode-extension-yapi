# Yapi

Yapi 接口文档工具，提升开发效率

## 快速上手

打开 vscode => Settings => #xtensions => Yapi box => 配置 Yapi 服务地址、账号、密码既可使用

### 自定义生成规则

在项目根目录添加 `yapi.config.js` 文件，实现 IYapiConfig 方法即可

```ts
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
   * @param suffix
   */
  formatInterfaceComment(t: InterfaceInfoModel, suffix: string): string;
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
  genCode(
    requestContent?: string,
    reqQueryType?: string,
    reqBodyForm?: string,
    reqBodyType?: string,
    resBodyType?: string
  ): string;
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
  requestFnName: "GET" | "POST" | "DELETE" | "PUT";
  /**
   * api 地址
   */
  apiPath: string;
}
```

示例

```js
{
    responseKey: 'all',
    genRequest(){
        // do something
    },
    formatInterfaceComment(){
        // do something
    },
    formatApiComment(){
        // do something
    },
    genCode(){
        // do something
    },
}
```

## 更新发布

### 0.0.2

- 支持 yapi url 动态参数拼接
- 显示出入参 数组和对象 备注信息

### 0.0.1

- Yapi 接口查看、搜索、查看日志
- 根据 Yapi 生成 Mock schema 和 Mock 数据
- 根据项目开发 Mock 服务，支持使用自定义 Mock schema
- 根据 Yapi 生成请求体、TS 类型定义，可自定义配置生成规则
