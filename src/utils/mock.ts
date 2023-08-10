import { mock } from 'mockjs';
import { isPlainObject } from '.';

const k = {
    string: "@string",
    number: '@float(0,1000,0,3)',
    boolean: '@boolean',
    integer: '@integer(0,1000)',
    date: '@date',
};

/**
 * 生成 Schema
 * @param json 
 * @returns 
 */
const getSchema = (json: any): any => {
    if (Array.isArray(json)) {
        return [getSchema(json[0])];
    } else if (isPlainObject(json)) {
        let data: any = {};
        Object.keys(json).forEach(key => {
            if (Array.isArray(json[key])) {
                data[key + '|1-20'] = getSchema(json[key]);
            } else {
                data[key] = getSchema(json[key]);
            }
        });
        return data;
    } else {
        return k[json as keyof typeof k];
    }
};

/**
 * 根据 Json 类型生成 Mock 数据
 * @param json 
 * @returns 
 */
export const runJsonMock = (json: any): any => mock(getSchema(json));

/**
 * 根据 Json 生成 Mock 结构
 * @param json 
 */
export const getMockSchema = (json: any): any => getSchema(json);

/**
 * 根据 Schema 模拟数据
 * @param schema 
 */
export const runSchemaMock = (schema: any): any => mock(schema);