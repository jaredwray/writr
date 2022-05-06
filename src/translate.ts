import * as fs from "fs-extra";

type Params = {
	path: string;
	key: string;
	lang: string;
}

export class Translate {

	async translate (params: Params) {
		const { path, key, lang } = params;
		const files = fs.readdirSync(path)
		files.forEach((file) => {
			const md = fs.readFileSync(`${path}/${file}`, "utf8");
			console.log('md', md);
			/*
			* The idea is get the md content and generate the file in a new language
			*
			* The problem is that how can I identify the language in the file?
			* What happen if the user run the command two times?
			*
			* The solution is to create a new folder with the language key and put the new md translated in it. But,
			* writr can't read the files inside the folder and don't generate the rendered files.
			* */


			/*
			* Another option is translate the html generated in a build process and put the new
			* files in the new language folder.
			* */
		})
	}

}
