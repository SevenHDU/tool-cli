export interface IPkgContent {
    devDependencies: {};
    dependencies: {};
}

export interface INpmConent {
    tags: {};
    deps: {};
}

export interface IDepContent {
    depName: string;
    ver: string;
}

export interface IDepList {
    depList: IDepContent[];
    devDepList: IDepContent[]
}