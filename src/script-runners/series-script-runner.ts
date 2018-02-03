import {ImbaProjectScriptListConfiguration} from '../definitions';
import {ScriptRunner} from './script-runner';


export class SeriesScriptRunner extends ScriptRunner
{


	protected async doRunScript(projects: ImbaProjectScriptListConfiguration): Promise<number>
	{
		let returnCode = 0;

		for (let name in projects) {
			if (projects.hasOwnProperty(name)) {
				const currentReturnCode = await this.runProjectScript(projects[name]);

				if (currentReturnCode > 0) {
					returnCode = currentReturnCode;
				}
			}
		}

		return returnCode;
	}

}
