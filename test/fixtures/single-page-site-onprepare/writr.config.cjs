module.exports.options = {
	templatePath: './template',
	outputPath: './dist',
	sitePath: './site',
	githubPath: 'jaredwray/writr',
	siteTitle: 'Writr',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://writr.org',
};

module.exports.onPrepare = async (opts) => {
	console.log('onPrepare');
};