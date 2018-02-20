import {EnvList} from '../environment-variable';
import {EventEmitter} from '../event-emitter';


export abstract class Runner
{


	public onStart: EventEmitter<string> = new EventEmitter<string>();

	public onStdout: EventEmitter<string> = new EventEmitter<string>();

	public onStderr: EventEmitter<string> = new EventEmitter<string>();

	public onFinish: EventEmitter<number> = new EventEmitter<number>();

	protected root: string;

	protected command: string;

	protected environment: EnvList;


	constructor(root: string, command: string, environment: EnvList)
	{
		this.root = root;
		this.command = command;
		this.environment = environment;
	}


	public abstract run(): Promise<number>;

}
