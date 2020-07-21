import {
    Command,
    SubOptions,
    CommandArgsProvider
} from 'func';
import chalk from 'chalk';
import { exec } from 'child_process';
import inquirer from 'inquirer';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { IPkgContent, INpmConent, IDepContent, IDepList} from '../types/upgrade.typs';
import { type } from 'os';

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
}, {
    name: 'prefix',
    type: String
}])
export class Upgrade {
    private pkgPath: string;
    private dep: string[];
    private tag: string;
    private cmdRunDir: string;
    private npmPkgPrefix: string;

    constructor(private arg: CommandArgsProvider) {
        this.pkgPath = arg.option.pkgPath;
        this.dep = arg.option.dep && arg.option.dep.split(',') || [];
        this.tag = arg.option.tag || 'latest';
        this.npmPkgPrefix = arg.option.prefix || '';
        this.run();
    }

    test() {
        console.log(__dirname);
        console.log(process.cwd());
    }

    async run() {
        // 1. 获取项目 package.json 文件 （包括文件路径校验）
        // 2. 解析文件依赖
        // 3. 更新 package.json 文件版本
        let filePath = this.checkPkgJsonFilePath(this.pkgPath);
        if (!filePath) {
            return ;
        }

        this.setCurrenWordDirByFilePath(filePath);

        const pkgContent = <IPkgContent>this.getProjectPkgJsonFile(filePath);
        const {depList, devDepList} = await this.getNpmPkgListByDep(pkgContent, this.dep);

        // this.updatePkgFileContent(filePath, depList, devDepList);
    }

    checkPkgJsonFilePath(filePath: string): string {
        if (!filePath) {
            return '';
        }

        // 程序自动处理没有 package.json 的情况
        if (!filePath.endsWith('package.json')) {
            filePath += filePath.endsWith('/') ? 'package.json' : '/package.json';
        }

        // 检查绝对路径
        if (fs.existsSync(filePath)) {
            return filePath;
        }

        // 检查相对路径
        filePath = path.join(process.cwd(), filePath);
        if (fs.existsSync(filePath)) {
            return filePath;
        }

        return '';
    }

    setCurrenWordDirByFilePath(filePath: string) {
        const lastIndex = filePath.lastIndexOf('/');

        this.cmdRunDir = filePath.substring(0, lastIndex);
    }

    getProjectPkgJsonFile(filePath: string) {
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

    async getNpmPkgListByDep(pkgContent: IPkgContent, deps: string[]): Promise<IDepList> {
        const depList: IDepContent[] = [];
        const devDepList: IDepContent[] = [];

        for (let dep in pkgContent.dependencies) {
            if (dep.startsWith('@types/')) {
                continue;
            }

            if (this.npmPkgPrefix && !dep.startsWith(this.npmPkgPrefix)) {
                continue;
            }

            const npmInfo = await this.getNpmPkgInfo(dep);
            if (npmInfo.deps) {
                let depsList = Object.keys(npmInfo.deps);
                for(let depItem of deps) {
                    if (!depsList.includes(depItem)) {
                        continue;
                    }

                    depList.push({
                        depName: dep,
                        ver: npmInfo.tags[this.tag]
                    });
                    break;
                }
            }
        }

        for (let dep in pkgContent.devDependencies) {
            if (dep.startsWith('@types/')) {
                continue;
            }

            if (this.npmPkgPrefix && !dep.startsWith(this.npmPkgPrefix)) {
                continue;
            }

            const npmInfo = await this.getNpmPkgInfo(dep);
            if (npmInfo.deps) {
                let depsList = Object.keys(npmInfo.deps);
                for(let depItem of deps) {
                    if (!depsList.includes(depItem)) {
                        continue;
                    }
                    
                    devDepList.push({
                        depName: dep,
                        ver: npmInfo.tags[this.tag]
                    });
                    break;
                }
            }
        }

        console.log('depList', depList);

        console.log('devDepList', devDepList);

        return {
            depList,
            devDepList 
        }
    }

    getNpmPkgInfo(dep: string) {
        const command = `npm view ${dep} dist-tags dependencies`;
        const spinner = ora({
            text: `excute command: ${command}`
        });
        return new Promise<INpmConent>((resolve, reject) => {
            spinner.start();
            exec(command, {cwd: this.cmdRunDir, encoding: 'utf-8'}, (err, stdout, stderr) => {
                if (err) {
                    console.log(chalk.red(`npm view ${dep} dependencies 异常: %s`), err);
                    console.log(err);
                    spinner.fail();
                    reject(err);
                    return ;
                }
                const reg = /{\s[\w:".,-^~\s]+\s}/gm;
                const formatText = stdout.replace(/\'/g, '"').replace(/\"?([\w-@/.]+)\"?:/g, '"$1":');
                const [tagsStr, depsStr] = formatText.match(reg);
                spinner.succeed();
                resolve({
                    tags: JSON.parse(tagsStr),
                    deps: depsStr ? JSON.parse(depsStr) : ''
                });
            });
        })
    }

    updatePkgFileContent(filePath: string, depList: IDepContent[], devDepList: IDepContent[]) {
        import(filePath).then((packageJSON) => {
            for(let dep of depList) {
                if (dep.ver && dep.ver !== packageJSON.default.dependencies[dep.depName]) {
                    packageJSON.default.dependencies[dep.depName] = dep.ver;
                }
            }

            for(let devDep of devDepList) {
                if (devDep.ver && devDep.ver !== packageJSON.default.dependencies[devDep.depName]) {
                    packageJSON.default.devDependencies[devDep.depName] = devDep.ver;
                }
            }

            fs.writeFileSync(filePath, JSON.stringify(packageJSON.default, null, 4));
        });
    }
}