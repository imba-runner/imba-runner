import {FileReader} from './file-reader';
import * as _ from 'lodash';


export class MockFileReader implements FileReader
{


	public files: {[name: string]: string} = {};

	public directories: Array<string> = [];


	public readFile(file: string): string
	{
		if (_.isUndefined(this.files[file])) {
			return;
		}

		return this.files[file];
	}


	public isDirectory(path: string): boolean
	{
		return this.directories.indexOf(path) >= 0;
	}

}