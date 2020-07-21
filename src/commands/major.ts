import { CommandMajor, CommandArgsProvider, SubOptions } from 'func'

@CommandMajor()
export class Major {
  constructor(private arg: CommandArgsProvider) {
    console.log('ok')
  }
}
