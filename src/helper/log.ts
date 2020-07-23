import chalk from 'chalk';

class Log {
    static info(text: string) {
        console.log(chalk.cyan(text));
    }

    static error(err: string) {
        console.log(chalk.red(err))
    }

    static success(text: string) {
        console.log(chalk.green(text))
    }

    static warn(warnText: string) {
        console.log(chalk.yellow(warnText));
    }
}


export default Log;