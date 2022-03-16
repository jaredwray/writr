import * as fs from "fs-extra";

export class Setup {

  private readonly name: string;
  private readonly gitignoreContent: string;
  private readonly packageJsonContent: Record<string, any>;

  constructor(name: string) {

    this.name = name;
    this.gitignoreContent = "### Node ###\n" +
      "# Logs\n" +
      "logs\n" +
      "*.log\n" +
      "npm-debug.log*\n" +
      "yarn-debug.log*\n" +
      "yarn-error.log*\n" +
      "lerna-debug.log*\n" +
      "# Dependency directories\n" +
      "node_modules/\n" +
      "jspm_packages/\n" +
      "# Optional npm cache directory\n" +
      ".npm\n";
    this.packageJsonContent = {
      name: this.name,
      version: "0.0.1",
      description: "",
      keywords: [],
      license: "ISC",
      author: "",
      scripts: {
        test: "echo \"Error: no test specified\" && exit 1"
      },
    }

  };

  async run() {
    try{
      fs.mkdirSync(this.name);
      fs.outputFileSync(`./${this.name}/.gitignore`, this.gitignoreContent);
      fs.outputFileSync(`./${this.name}/package.json`, JSON.stringify(this.packageJsonContent, null, 2));
      fs.copySync(`${__dirname}/../../blog_example`, `./${this.name}/blog`);
    } catch (error: any) {
      throw new Error('Directory already exists');
    }
  }

}
