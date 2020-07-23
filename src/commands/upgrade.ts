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
import Log from '../helper/log';
import { initQuestions, upgradeCheckQuestion } from '../biz/questions';
import { IPkgContent, INpmConent, IDepContent, IDepList } from '../types/upgrade.types';

@Command({
    name: 'upgrade',
})
@SubOptions([{
    name: 'p', // package.json 目录路径
    type: String
}, {
    name: 'd', // 依赖的基本 npm 包集合，依赖该包集合的 npm 包需要升级
    type: String
}, {
    name: 't', // beta: 测试开发版本；lastest: 当前稳定版本; next: 先行版本
    type: String,
}, {
    name: 'i', // 需要检索的 npm 包正则，默认检索所有的包，加了正则，可以提高检索效率
    type: String
}])
export class Upgrade {
    private pkgPath: string;
    private dep: string[];
    private tag: string;
    private cmdRunDir: string;
    private includeReg: RegExp | string;

    constructor(private arg: CommandArgsProvider) {
        this.pkgPath = arg.option.p;
        this.dep = arg.option.d && arg.option.d.split(',') || [];
        this.tag = arg.option.t;
        this.includeReg = arg.option.i ? eval(arg.option.i) : '';
        if (!this.pkgPath) {
            // 交互式体验
            this.interactiveRun();
        } else {
            // 直接命令式体验
            this.run();
        }
    }

    async interactiveRun() {
        const ans = await inquirer.prompt(initQuestions);

        const dep = ans.dep as string;

        this.pkgPath = ans.pkgPath as string;
        this.dep = dep.split(',') || [];
        this.tag = ans.tag as string;
        this.includeReg = ans.include ? eval(ans.include as string) : '';

        this.run();
    }

    async run() {
        // 1. 获取项目 package.json 文件 （包括文件路径校验）
        // 2. 解析文件依赖
        // 3. 更新 package.json 文件版本
        const filePath = this.checkPkgJsonFilePath(this.pkgPath);
        if (!filePath) {
            Log.error('请检查 package.json 文件地址')
            return;
        }

        Log.info(`项目工程 package.json 路径：${chalk.greenBright(filePath)}`);

        this.setCurrenWordDirByFilePath(filePath);

        const pkgContent = this.getProjectPkgJsonFile(filePath) as IPkgContent;
        const { depList, devDepList } = await this.getNpmPkgListByDep(pkgContent, this.dep);

        this.updatePkgFileContent(filePath, depList, devDepList);
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
            return path.resolve(filePath);
        }

        // 检查相对路径
        filePath = path.join(process.cwd(), filePath);
        if (fs.existsSync(filePath)) {
            return path.resolve(filePath);
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

        for (const dep in pkgContent.dependencies) {
            if (dep.startsWith('@types/')) {
                continue;
            }

            if (this.includeReg instanceof RegExp && !this.includeReg.test(dep)) {
                continue;
            }

            const npmInfo = await this.getNpmPkgInfo(dep);
            if (npmInfo.deps) {
                const depsList = Object.keys(npmInfo.deps);
                for (const depItem of deps) {
                    if (!depsList.includes(depItem) && dep !== depItem) {
                        continue;
                    }

                    depList.push({
                        depName: dep,
                        ver: this.tag ? npmInfo.tags[this.tag] : ''
                    });
                    break;
                }
            }
        }

        for (const dep in pkgContent.devDependencies) {
            if (dep.startsWith('@types/')) {
                continue;
            }

            if (this.includeReg instanceof RegExp && !this.includeReg.test(dep)) {
                continue;
            }

            const npmInfo = await this.getNpmPkgInfo(dep);
            if (npmInfo.deps) {
                const depsList = Object.keys(npmInfo.deps);
                for (const depItem of deps) {
                    if (!depsList.includes(depItem)) {
                        continue;
                    }

                    devDepList.push({
                        depName: dep,
                        ver: this.tag ? npmInfo.tags[this.tag] : ''
                    });
                    break;
                }
            }
        }

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
            exec(command, { cwd: this.cmdRunDir, encoding: 'utf-8' }, (err, stdout, stderr) => {
                if (err) {
                    console.log(chalk.red(`npm view ${dep} dependencies 异常: %s`), err);
                    console.log(err);
                    spinner.fail();
                    reject(err);
                    return;
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
        const toUpgradeNpmList = [];
        import(filePath).then(async (packageJSON) => {
            for (const dep of depList) {
                if (dep.ver && dep.ver !== packageJSON.default.dependencies[dep.depName]) {
                    toUpgradeNpmList.push({
                        depName: dep.depName,
                        message: `${packageJSON.default.dependencies[dep.depName]} -> ${dep.ver}`
                    });

                    packageJSON.default.dependencies[dep.depName] = dep.ver;
                }
            }

            for (const devDep of devDepList) {
                if (devDep.ver && devDep.ver !== packageJSON.default.devDependencies[devDep.depName]) {
                    toUpgradeNpmList.push({
                        depName: devDep.depName,
                        message: `${packageJSON.default.devDependencies[devDep.depName]} -> ${devDep.ver}`
                    });

                    packageJSON.default.devDependencies[devDep.depName] = devDep.ver;
                }
            }

            if (toUpgradeNpmList.length === 0) {
                Log.success('恭喜你，该工程已经升级到最新版本，无需到手动升级！');
                return;
            };

            Log.info('--- 待升级的 npm 包 ---');

            for (const npmPkg of toUpgradeNpmList) {
                Log.info(`${npmPkg.depName}: ${npmPkg.message}`);
            }

            const ans = await inquirer.prompt(upgradeCheckQuestion);

            if (ans.upgrade) {
                fs.writeFileSync(filePath, JSON.stringify(packageJSON.default, null, 4));
                Log.success('已同步更新 package.json！若项目中有 package-lock.json，请手动执行 npm install，同步更新 package-lock.json');
            } else {
                process.exit();
            }
        });
    }
}