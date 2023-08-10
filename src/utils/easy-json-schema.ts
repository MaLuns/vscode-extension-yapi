
function isPlainObject(obj: any) {
    return obj ? typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype : false;
}

const supportType = ['string', 'number', 'array', 'object', 'boolean', 'integer'];

function getType(type: any) {
    if ([undefined, null].includes(type)) {
        return 'string';
    }
    if (supportType.indexOf(type) !== -1) {
        return type;
    }
    return typeof type;
}

function isSchema(object: any) {
    if (supportType.indexOf(object.type) !== -1) {
        return true;
    }
    return false;
}

function handleSchema(json: any, schema: any) {
    Object.assign(schema, json);
    if (schema.type === 'object') {
        delete schema.properties;
        parse(json.properties, schema);
    }
    if (schema.type === 'array') {
        delete schema.items;
        schema.items = {};
        parse(json.items, schema.items);
    }

}

function handleArray(arr: any[], schema: any) {
    schema.type = 'array';
    const props = schema.items = {};
    parse(arr[0], props);
}

function handleObject(json: any, schema: any) {
    if (isSchema(json)) {
        return handleSchema(json, schema);
    }
    schema.type = 'object';
    schema.required = [];
    const props = schema.properties = {};
    for (let key in json) {
        const item = json[key];
        //@ts-ignore
        let curSchema = props[key] = {};
        if (key[0] === '*') {
            //@ts-ignore
            delete props[key];
            key = key.substr(1);
            schema.required.push(key);
            //@ts-ignore
            curSchema = props[key] = {};

        }
        parse(item, curSchema);
    }
}

function parse(json: any, schema: any) {
    if (Array.isArray(json)) {
        handleArray(json, schema);
    } else if (isPlainObject(json)) {
        handleObject(json, schema);
    } else {
        schema.type = getType(json);
    }
}

export default function (data: any) {
    const JsonSchema = {};
    parse(data, JsonSchema);
    return JsonSchema;
}

