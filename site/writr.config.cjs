const fs = require('fs-extra');
const path = require('path');
const process = require('node:process');

module.exports.options = {
	templatePath: './template',
	githubPath: 'jaredwray/writr',
	siteTitle: 'Writr',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://writr.org',
};

module.exports.onPrepare = async (config) => {
	const readmePath = path.join(process.cwd(), './README.md');
	const readmeSitePath = path.join(config.sitePath, 'README.md');
	const readme = await fs.readFile(readmePath, 'utf8');
	const updatedReadme = readme.replace('![Writr](site/logo.svg)','');
	console.log('writing updated readme to ', readmeSitePath);
	await fs.writeFile(readmeSitePath, updatedReadme);
}