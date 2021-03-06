import {ChildProcessFactory, MockChildProcessFactory} from '@imba/spawn';
import {ScriptContext} from './script-context';
import {Input, InputOptions, InputsList} from './input';
import {EnvironmentVariable} from './environment-variable';
import {RunContext, RunState} from './run-context';
import {Project} from './project';
import {Imba} from './imba';
import * as _ from 'lodash';


export declare type ScriptDefinitionCallback = (storage: ScriptContext, context: RunContext) => void;
export declare type ScriptOrDefinitionCallback = ScriptDefinitionCallback|string|Array<string>;

export enum ScriptMode
{
	Series = 'series',
	Parallel = 'parallel',
}


export class Script
{


	public readonly name: string;

	private _locked: boolean = false;

	private _imba: Imba;

	private _definition: ScriptDefinitionCallback;

	private _parent: Script|undefined;

	private _mode: ScriptMode = ScriptMode.Parallel;

	private _only: Array<string> = [];

	private _except: Array<string> = [];

	private _before: Array<Script> = [];

	private _after: Array<Script> = [];

	private _inputs: Array<Input> = [];

	private _env: Array<EnvironmentVariable> = [];

	private _hidden: boolean = false;

	private _description: string|undefined;


	constructor(imba: Imba, name: string, definition: ScriptDefinitionCallback, parent?: Script)
	{
		this._imba = imba;
		this.name = name;
		this._definition = definition;
		this._parent = parent;
	}


	public loadConfiguration(): void
	{
		const ctx = this.createScriptContext(new MockChildProcessFactory, new RunContext(RunState.Load, Project.createSystemProject()));
		const commands = ctx.getCommands();

		for (let i = 0; i < commands.length; i++) {
			this._inputs = this._inputs.concat(commands[i].getInputs());
		}

		this._locked = true;
	}


	public createScriptContext(childProcessFactory: ChildProcessFactory, ctx: RunContext): ScriptContext
	{
		const storage = new ScriptContext(this._imba, childProcessFactory, this);
		this._definition(storage, ctx);

		return storage;
	}


	public hasDescription(): boolean
	{
		return typeof this._description !== 'undefined';
	}


	public getDescription(): string|undefined
	{
		return this._description;
	}


	public describe(description: string): void
	{
		if (this._locked) {
			return;
		}

		this._description = description;
	}


	public getMode(): ScriptMode
	{
		if (this._parent) {
			return this._parent.getMode();
		}

		return this._mode;
	}


	public mode(mode: ScriptMode): Script
	{
		if (this._locked) {
			return this;
		}

		this._mode = mode;
		return this;
	}


	public only(only: Array<string>): Script
	{
		if (this._locked) {
			return this;
		}

		this._only = only;
		return this;
	}


	public except(except: Array<string>): Script
	{
		if (this._locked) {
			return this;
		}

		this._except = except;
		return this;
	}


	public hasBeforeScripts(): boolean
	{
		return this._before.length > 0;
	}


	public getBeforeScripts(recursive: boolean = false): Array<Script>
	{
		if (!recursive) {
			return this._before;
		}

		return this._getRecursiveScripts([], (script) => script.getBeforeScripts());
	}


	public before(scriptOrDefinition: ScriptOrDefinitionCallback): Script
	{
		if (this._locked) {
			return this;
		}

		if (_.isArray(scriptOrDefinition)) {
			this._before = [];

			for (let i = 0; i < scriptOrDefinition.length; i++) {
				this.before(scriptOrDefinition[i]);
			}

			return this;
		}

		let script: Script;

		if (_.isString(scriptOrDefinition)) {
			script = this._imba.getScript(scriptOrDefinition, true);

		} else {
			script = (new Script(this._imba, `${this.name}:before:${this._before.length}`, scriptOrDefinition, this))
				.hide();
		}

		this._before.push(script);
		return this;
	}


	public hasAfterScripts(): boolean
	{
		return this._after.length > 0;
	}


	public getAfterScripts(recursive: boolean = false): Array<Script>
	{
		if (!recursive) {
			return this._after;
		}

		const scripts = this._getRecursiveScripts([], (script) => script.getAfterScripts());
		return scripts.reverse();
	}


	public after(scriptOrDefinition: ScriptOrDefinitionCallback): Script
	{
		if (this._locked) {
			return this;
		}

		if (_.isArray(scriptOrDefinition)) {
			this._after = [];

			for (let i = 0; i < scriptOrDefinition.length; i++) {
				this.after(scriptOrDefinition[i]);
			}

			return this;
		}

		let script: Script;

		if (_.isString(scriptOrDefinition)) {
			script = this._imba.getScript(scriptOrDefinition, true);

		} else {
			script = (new Script(this._imba, `${this.name}:after:${this._after.length}`, scriptOrDefinition, this))
				.hide();
		}

		this._after.push(script);
		return this;
	}


	public hasInputs(): boolean
	{
		return this._inputs.length > 0;
	}


	public getInputs(): Array<Input>
	{
		return this._inputs;
	}


	public getAllRecursiveInputs(): InputsList
	{
		const before = this.getBeforeScripts(true);
		const after = this.getAfterScripts(true);

		const inputs: InputsList = {};

		inputs[this.name] = this.getInputs();

		for (let i = 0; i < before.length; i++) {
			inputs[before[i].name] = before[i].getInputs();
		}

		for (let i = 0; i < after.length; i++) {
			inputs[after[i].name] = after[i].getInputs();
		}

		return inputs;
	}


	public input(name: string, question: string, options: InputOptions = {}): Script
	{
		if (this._locked) {
			return this;
		}

		const input = new Input(name, question);

		if (!_.isUndefined(options.defaultValue)) {
			input.defaultValue = options.defaultValue;
		}

		if (!_.isUndefined(options.required)) {
			input.required = options.required;
		}

		this._inputs.push(input);

		return this;
	}


	public hasEnvs(): boolean
	{
		return this._env.length > 0;
	}


	public getEnvs(): Array<EnvironmentVariable>
	{
		return this._env;
	}


	public env(name: string, value: string): Script
	{
		if (this._locked) {
			return this;
		}

		const env = new EnvironmentVariable(name, value);
		this._env.push(env);

		return this;
	}


	public getAllowedProjects(): Array<Project>
	{
		const projects = this._imba.getProjects();
		const result: Array<Project> = [];

		for (let i = 0; i < projects.length; i++) {
			let project = projects[i];

			if (this.isAllowedForProject(project)) {
				result.push(project);
			}
		}

		return result;
	}


	public isAllowedForProject(project: Project): boolean
	{
		const only = this._parent ? this._parent._only : this._only;
		const except = this._parent ? this._parent._except : this._except;

		if (except.indexOf(project.name) >= 0) {
			return false;
		}

		if (only.length > 0 && only.indexOf(project.name) < 0) {
			return false;
		}

		return true;
	}


	public hide(): Script
	{
		if (this._locked) {
			return this;
		}

		this._hidden = true;
		return this;
	}


	public isHidden(): boolean
	{
		return this._hidden;
	}


	private _getRecursiveScripts(stack: Array<string>, getter: (script: Script) => Array<Script>): Array<Script>
	{
		if (stack.indexOf(this.name) >= 0) {
			throw new Error(`Script ${this.name} contains circular dependency: ${stack.join(', ')}.`);
		}

		stack.push(this.name);

		let result: Array<Script> = [];
		let scripts = getter(this);

		for (let i = 0; i < scripts.length; i++) {
			let script = scripts[i];

			result.push(script);
			result = script._getRecursiveScripts(stack, getter).concat(result);
		}

		return result;
	}

}
