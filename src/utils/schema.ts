let fieldNum = 1;

const _ = {
    isArray: Array.isArray,
    isUndefined: (t: any) => t === undefined,
    isObject: (obj: any) => {
        var type = typeof obj;
        return type === 'function' || (type === 'object' && !!obj);
    }
};

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

const isBasicType = (type: `${YapiDataType}`) => {
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
 * Yapi schema 转 Json 格式 
 * @param schema 
 * @param isOnlyType 是否只需要类型 
 * @param isComment 是否需要 数组-对象 描述信息
 * @returns 
 */
export const schema2Json = (schema: any, isOnlyType = false, isComment = false) => {
    try {
        const data = schema2Table(schema);
        if (data) {
            // 获取字段描述
            const getkeyDesc = (item: any, type: string | undefined, isOnlyType: boolean) => {
                if (isOnlyType) {
                    return type;
                } else {
                    return `${item.desc ? item.desc : ''} ${item?.sub?.enumDesc ? item.sub.enumDesc : ''} ${type ? `<${type}> ` : ''}${item.required ? '<必传>' : ''}`.trim();
                }
            };

            // 转 JSON
            const toJson = (rows: any[]) => {
                let res: { [k: string]: any; } = {};
                rows.forEach(item => {
                    if (item.type) {
                        if (isBasicType(item.type)) {
                            // basic type
                            res[item.name] = getkeyDesc(item, item.type, isOnlyType);
                        } else if (item.type === 'object') {
                            // object
                            res[item.name] = {
                                ...toJson(item.children)
                            };
                        } else if (Array.isArray(item.type)) { // fix: type 有可能存在多个类型
                            res[item.name] = getkeyDesc(item, item.type.join('|'), isOnlyType);
                        } else {
                            // Array
                            if (isBasicType(item.sub.itemType)) {
                                // Array 子类为基础类型
                                res[item.name] = [getkeyDesc(item, item.sub.itemType, isOnlyType)];
                            } else if (item.sub.itemType) {
                                // Array 子类为对象
                                res[item.name] = [];
                                if (!isOnlyType && isComment) {
                                    const desc = getkeyDesc(item, undefined, isOnlyType);
                                    desc && res[item.name].push('//' + desc);
                                }
                                res[item.name].push(toJson(item.children));
                            }
                        }
                    } else if (item.itemType) {
                        res = [];
                        if (isBasicType(item.itemType)) {
                            const attr = item.children[0];
                            res.push(getkeyDesc(attr, item.itemType, isOnlyType));
                        } else if (item.itemType === 'object') {
                            res.push(toJson(item.children));
                        } else {
                            res.push(toJson(item.children));
                        }
                    }
                });
                return res;
            };
            return toJson(data);
        }
    } catch (error) {
        console.log(error);
    }
};

/**
 * Yapi schema 转 Table 格式
 * @param schema 
 * @returns 
 */
export const schema2Table = (schema: any): any[] | undefined => {
    try {
        schema = checkJsonSchema(schema);
        let result = Schema(schema, 0);
        result = _.isArray(result) ? result : [result];
        return result;
    } catch (err) {
    }
};


//#region schema 转 数组格式
//  自动添加type
const checkJsonSchema = (json: any) => {
    let newJson = Object.assign({}, json);
    if (_.isUndefined(json.type) && _.isObject(json.properties)) {
        newJson.type = 'object';
    }
    return newJson;
};

const mapping = function (data: any, index: number | string): any {
    switch (data.type) {
        case 'string':
            return SchemaString(data);
        case 'number':
            return SchemaNumber(data);
        case 'array':
            return SchemaArray(data, <number>index);
        case 'object':
            return SchemaObject(data, <string>index);
        case 'boolean':
            return SchemaBoolean(data);
        case 'integer':
            return SchemaInt(data);
        default:
            return SchemaOther(data);
    }
};

const ConcatDesc = (title: string, desc: String) => {
    return [title, desc].join('\n').trim();
};

const Schema = (data: any, key: string | number) => {
    let result = mapping(data, key);
    if (data.type !== 'object') {
        let desc = result.desc;
        let d = result.default;
        let children = result.children;

        delete result.desc;
        delete result.default;
        delete result.children;
        let item = {
            type: data.type,
            key,
            desc,
            default: d,
            sub: result
        };

        if (_.isArray(children)) {
            item = Object.assign({}, item, { children });
        }

        return item;
    }

    return result;
};

const SchemaObject = (data: any, key: string) => {
    let { properties, required } = data;
    properties = properties || {};
    required = required || [];
    let result: any[] = [];
    Object.keys(properties).map((name, index) => {
        let value = properties[name];
        let copiedState = checkJsonSchema(JSON.parse(JSON.stringify(value)));

        let optionForm = Schema(copiedState, key + '-' + index);
        let item: any = {
            name,
            key: key + '-' + index,
            desc: ConcatDesc(copiedState.title, copiedState.description),
            required: required.indexOf(name) !== -1
        };

        if (value.type === 'object' || (_.isUndefined(value.type) && _.isArray(optionForm))) {
            item = Object.assign({}, item, { type: 'object', children: optionForm });
            delete item.sub;
        } else {
            item = Object.assign({}, item, optionForm);
        }

        result.push(item);
    });

    return result;
};

const SchemaString = (data: any) => {
    let item = {
        desc: ConcatDesc(data.title, data.description),
        default: data.default,
        maxLength: data.maxLength,
        minLength: data.minLength,
        enum: data.enum,
        enumDesc: data.enumDesc,
        format: data.format,
        mock: data.mock && data.mock.mock
    };
    return item;
};

const SchemaArray = (data: any, index: number) => {
    data.items = data.items || { type: 'string' };
    let items = checkJsonSchema(data.items);
    let optionForm = mapping(items, index);
    //  处理array嵌套array的问题
    let children = optionForm;
    if (!_.isArray(optionForm) && !_.isUndefined(optionForm)) {
        optionForm.key = 'array-' + fieldNum++;
        children = [optionForm];
    }

    let item = {
        desc: ConcatDesc(data.title, data.description),
        default: data.default,
        minItems: data.minItems,
        uniqueItems: data.uniqueItems,
        maxItems: data.maxItems,
        itemType: items.type,
        children
    };
    if (items.type === 'string') {
        item = Object.assign({}, item, { itemFormat: items.format });
    }
    return item;
};

const SchemaNumber = (data: any) => {
    let item = {
        desc: ConcatDesc(data.title, data.description),
        maximum: data.maximum,
        minimum: data.minimum,
        default: data.default,
        format: data.format,
        enum: data.enum,
        enumDesc: data.enumDesc,
        mock: data.mock && data.mock.mock
    };
    return item;
};

const SchemaInt = (data: any) => {
    let item = {
        desc: ConcatDesc(data.title, data.description),
        maximum: data.maximum,
        minimum: data.minimum,
        default: data.default,
        format: data.format,
        enum: data.enum,
        enumDesc: data.enumDesc,
        mock: data.mock && data.mock.mock
    };
    return item;
};

const SchemaBoolean = (data: any) => {
    let item = {
        desc: ConcatDesc(data.title, data.description),
        default: data.default,
        enum: data.enum,
        mock: data.mock && data.mock.mock
    };
    return item;
};

const SchemaOther = (data: any) => {
    let item = {
        desc: ConcatDesc(data.title, data.description),
        default: data.default,
        mock: data.mock && data.mock.mock
    };
    return item;
};
//#endregion
