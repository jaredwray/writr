import * as del from "del";
import * as fs from "fs-extra";
import { createCommand } from "commander";

import {DataService} from "./data/dataService";
import {Config} from "./config";
import {HtmlRenderProvider} from "./render/htmRenderlProvider";
import {JSONRenderProvider} from "./render/jsonRenderProvider";
import {AtomRenderProvider} from "./render/atomRenderProvider";
import {ImageRenderProvider} from "./render/imageRenderProvider";
import {Migrate} from "./migrate";
import {Setup} from "./utils/setup";
import {ConsoleMessage} from "./log";

export class Writr {

  config: Config | undefined;
  data: DataService | undefined;
  command: string | undefined;

  parseCLI(process: NodeJS.Process) {

    const program = createCommand();

    program.storeOptionsAsProperties(true);

    program
      .command('build', {isDefault: true})
      .description('Build the site')
      .option("-p, --path <path>", "Path of where the blog, config, and template are located")
      .option("-o, --output <path>", "Path of where to output the generated blog")
      .option("-r, --render <list>", "What do you want rendered such as html or json (example --render html,json)")
      .option("-c, --config <path>", "custom configuration path")
      .option("-m, --migrate <type> <source> <destination>", "Migrate from Jekyll to Writr")
      .action((options: any) => {
        this.command = "build";

        const params = options.opts();

        this.config = new Config();

        if (params.config) {
          this.config.loadConfig(params.config);
        }

        if (params.path) {
          this.config.loadPath(params.path);
        }

        if (params) {
          this.config.loadParams(params)
        }

        this.config.loadProgram(options);

        this.data = new DataService(this.config);
      })

    program
      .command('init')
      .description('Initialize a new Writr project')
      .argument('[name]', 'Name of the project', 'Blog')
      .action(async (name: string) => {
        try{
          this.command = "init";
          await new Setup(name).init();
        } catch (error: any) {
          new ConsoleMessage().error('Error: '+ error.message);
        }
      })

    program
      .command('new')
      .description('Create new markdown file')
      .action(async() => {
        try{
          this.command = "new";
          await new Setup('new').new();
        } catch (error: any) {
          new ConsoleMessage().error('Error: '+ error.message);
        }
      })

    program.parse(process.argv);

  }

  async runCLI(): Promise<boolean> {
    let result = true;

    if (this.data === undefined || this.config === undefined) {
      return false;
    }

    const {migrate} = this.config.params;

    if (migrate) {
      const [src, dest] = this.config.program.args;
      await new Migrate(migrate).migrate(src, dest);
      return true;
    }

    if (fs.existsSync(this.config.output)) {
      del.sync(this.config.output);
    }

    let render: boolean | undefined = true;

    for (let i = 0; i < this.config.render.length; i++) {
      let type = this.config.render[i];
      if (type === "html") {
        render = await new HtmlRenderProvider().render(this.data, this.config);
      }
      if (type === "json") {
        render = await new JSONRenderProvider().render(this.data, this.config);
      }
      if (type === "atom") {
        render = await new AtomRenderProvider().render(this.data, this.config);
      }
      if (type === "images") {
        render = await new ImageRenderProvider().render(this.data, this.config);
      }
    }

    if (render) {
      result = render;
    }

    return result;
  }
}
