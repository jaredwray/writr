module.exports.options = {
	templatePath: './template',
	outputPath: './dist-js',
	sitePath: './site',
	githubPath: 'jaredwray/writr',
	siteTitle: 'Writr',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://writr.org',
};

module.exports.onPrepare = async (opts) => {
	throw new Error('onPrepare');
};