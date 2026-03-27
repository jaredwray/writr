import type { DoculaOptions } from 'docula';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const options: Partial<DoculaOptions> = {
	githubPath: 'jaredwray/writr',
	siteTitle: 'Writr',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://writr.org',
	themeMode: 'light',
	ai: {
		provider: 'anthropic',
		apiKey: process.env.ANTHROPIC_API_KEY!,
	},
};

export const onPrepare = async (options: DoculaOptions) => {
	const readmePath = path.join(process.cwd(), './README.md');
	const readmeSitePath = path.join(options.sitePath, 'README.md');
	const readme = await fs.promises.readFile(readmePath, 'utf8');
	const updatedReadme = readme.replace('![Writr](site/logo.svg)', '');
	console.log('writing updated readme to', readmeSitePath);
	await fs.promises.writeFile(readmeSitePath, updatedReadme);
};
