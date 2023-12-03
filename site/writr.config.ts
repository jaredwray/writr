
import writr, {WritrHelpers} from '../dist/writr.js';

export const writrOptions = {
	templatePath: './template',
	outputPath: './dist',
	sitePath: './site',
	githubPath: 'jaredwray/writr',
	siteTitle: 'Writr',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://writr.org',
};

export function onPrepare(writrOptions?: any) {
	// Copy the template to the site path
	const removeImage = (content: string) => content.replace('![Writr](site/logo.png)', '');
	const writrHelpers = new WritrHelpers();
	writrHelpers.createDoc(
		'../README.md',
		'./site/README.md',
		undefined, // No need to set the front matter
		removeImage,
	);
}
