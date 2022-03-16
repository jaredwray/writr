import * as fs from "fs-extra";
import * as inquirer from "inquirer";
import {Parser} from "./parser";

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

  async init() {
    try{
      fs.mkdirSync(this.name);
      fs.outputFileSync(`./${this.name}/.gitignore`, this.gitignoreContent);
      fs.outputFileSync(`./${this.name}/package.json`, JSON.stringify(this.packageJsonContent, null, 2));
      fs.copySync(`${__dirname}/../../blog_example`, `./${this.name}/blog`);
    } catch (error: any) {
      throw new Error('Directory already exists');
    }
  }

  async new() {
    try{
      const questions = [
        {
          name: 'title',
          message: 'What is the title of the post?',
        },
        {
          name: 'categories',
          message: 'Please enter the categories of the post separated by commas',
        },
        {
          name: 'tags',
          message: 'Please enter the tags of the post separated by commas',
        },
        {
          name: 'date',
          message: 'Please enter the date of the post in the format YYYY-MM-DD',
          default: new Date().toLocaleDateString('en-CA'),
        },
      ]
      const prompt = inquirer.createPromptModule();
      const response = await prompt(questions);
      response.slug = new Parser().slugify(response.title);

      const headerContent = new Parser().generateMdHeaders(response)

      await fs.outputFileSync(`${response.slug}.md`, headerContent);

    } catch (error: any) {
      throw new Error('Error creating new file');
    }
  }

}
