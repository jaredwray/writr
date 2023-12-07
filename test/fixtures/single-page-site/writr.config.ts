
export const options = {
	templatePath: './template',
	outputPath: './dist',
	sitePath: './site',
	githubPath: 'jaredwray/writr',
	siteTitle: 'Writr',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://writr.org',
};

export function onPrepare(writrOptions?: any) {
	console.log('onPrepare');
}
