import {
    Command,
    SubOptions,
    CommandArgsProvider
} from 'func';
import chalk from 'chalk';
import { exec } from 'child_process';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { chdir } from 'process';

interface IPkgContent {
    devDependencies: {};
    dependencies: {};
}

interface INpmConent {
    tags: {};
    deps: {};
}

interface IDepConetn {
    depName: string;
    ver: string;
}

@Command({
    name: 'upgrade',
})
@SubOptions([{
    name: 'pkgPath',
    type: String
}, {
    name: 'dep',
    type: String
}, {
    name: 'tag',
    type: String,
}])
export class Upgrade {
    private pkgPath: string;
    private dep: string | string[];
    private tag: string;

    constructor(private arg: CommandArgsProvider) {
        this.pkgPath = arg.option.pkgPath;
        this.dep = arg.option.dep;
        this.tag = arg.option.tag || 'beta';

        this.run();
    }

    async run() {
        // 1. 获取项目 package.json 文件 （包括文件路径校验）
        // 2. 解析文件依赖
        // 3. 更新 package.json 文件版本

        const pkgContent = <IPkgContent>this.getProjectPkgJsonFile(this.pkgPath);
        const depList = this.getNpmPkgListByDep(pkgContent, this.dep);
    }

    getProjectPkgJsonFile(filePath: string) {
        if (!filePath) {
            console.log(chalk.red('请使用 --pkgPath 指定项目 package.json 地址'));
        }

        if (fs.existsSync(filePath)) {
            const pkgContent = JSON.parse(fs.readFileSync(filePath).toString());
            return pkgContent;
        }

        filePath = path.join(__dirname, filePath);

        if (fs.existsSync(filePath)) {
            const pkgContent = fs.readFileSync(filePath).toJSON();
            return pkgContent;
        }
    }

    async getNpmPkgListByDep(pkgContent: IPkgContent, deps: string | string[]) {
        const res: IDepConetn[] = [];

        for (let dep in pkgContent.dependencies) {
            const npmInfo = await this.getNpmPkgInfo(dep);
            if (npmInfo.deps) {
                if (typeof deps === 'string' && Object.keys(npmInfo.deps).includes(deps)) {
                    res.push({
                        depName: dep,
                        ver: npmInfo.tags[this.tag]
                    });
                }
            }
        }

        for (let dep in pkgContent.devDependencies) {
            if (dep.startsWith('@types/')) {
                continue;
            }
            console.log(dep);
            const npmInfo = await this.getNpmPkgInfo(dep);
            if (npmInfo.deps) {
                if (typeof deps === 'string' && Object.keys(npmInfo.deps).includes(deps)) {
                    res.push({
                        depName: dep,
                        ver: npmInfo.tags[this.tag]
                    });
                }
            }
        }

        // console.log(res);
    }

    getNpmPkgInfo(dep: string) {
        return new Promise<INpmConent>((resolve, reject) => {
            exec(`npm view ${dep} dist-tags dependencies`, {cwd: process.cwd(), encoding: 'utf-8'}, (err, stdout, stderr) => {
                if (err) {
                    console.log(chalk.red(`npm view ${dep} dependencies 异常: %s`), err);
                    reject(err);
                    return ;
                }
                const reg = /{\s[\w:".,-^~\s]+\s}/gm;
                const formatText = stdout.replace(/\'/g, '"').replace(/\"?([\w-@/]+)\"?:/g, '"$1":');
                const [tagsStr, depsStr] = formatText.match(reg);
                resolve({
                    tags: JSON.parse(tagsStr),
                    deps: depsStr ? JSON.parse(depsStr) : ''
                });
            });
        })
    }
}