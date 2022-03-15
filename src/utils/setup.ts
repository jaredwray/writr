import * as shell from 'shelljs';

export class Setup {

  private readonly name: string;
  private readonly destPath: string;
  private readonly gitignoreContent: string;

  constructor(name: string) {
    this.name = name;
    this.destPath = `${process.cwd()}/${name}`;
    this.gitignoreContent = `### Node ###
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm
`;
    shell.config.silent = true;
  };


  async run() {
    shell.mkdir('-p', this.destPath);
    shell.cd(this.destPath);
    shell.echo(this.gitignoreContent).to('.gitignore');
    shell.exec('npm init -y', {silent:true});
    const content = `# ${this.name}`;
    shell.cd(this.destPath);
    shell.echo(content).to('Readme.md');
    console.log(__dirname);
    shell.cp('-R', `${__dirname}/../../blog_example/`, 'blog');
  }

}
