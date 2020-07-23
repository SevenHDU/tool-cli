
const initQuestions = [{
    name: 'pkgPath',
    message: '请输入工程目录（package.json 所在目录)',
    default: './'
}, {
    name: 'dep',
    message: '基础依赖 npm 包，若有多个，请用逗号（半角）分割。例如 @kaola/core.app,@kaola/core.util',
    validate: (dep) => {
        return dep ? true : '请输入至少一个基本依赖 npm 包';
    }
}, {
    type: 'list',
    name: 'tag',
    message: '选择需要更新的 tag 版本。若对应 tag 无版本，请通知包维护者按照 tag 规范执行',
    choices: ['beta', 'latest', 'next'],
}, {
    name: 'include',
    message: '输入需要检查的 npm 包正则，例如 /@kaola\\/core/，默认检索所有的 npm 包',
    validate: (reg) => {
        if (!reg) {
            return true;
        }

        try {
            const isReg = eval(reg) instanceof RegExp;
            return isReg ? true : '请输入有效的正则表达式';
        } catch (e) {
            return '请输入有效的正则表达式';
        }
    }
}];

const upgradeCheckQuestion = [{
    type: 'confirm',
    name: 'upgrade',
    message: '立马升级？'
}];

export {
    initQuestions,
    upgradeCheckQuestion
}