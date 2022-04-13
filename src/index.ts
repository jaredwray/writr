import { createCommand } from "commander";

import {DataService} from "./data/dataService";
import {Config} from "./config";
import {Setup} from "./utils/setup";
import {ConsoleMessage} from "./log";
import {Serve} from "./serve";
import {SiteGenerator} from "./generator";
import {Migrate} from "./migrate";

export class Writr {

  config: Config | undefined;
  data: DataService | undefined;
  result = false;

  async parseCLI(process: NodeJS.Process) {

    const program = createCommand();

    program.storeOptionsAsProperties(true);

    program
      .command('build', {isDefault: true})
      .description('Build the site')
      .option("-p, --path <path>", "Path of where the blog, config, and template are located")
      .option("-o, --output <path>", "Path of where to output the generated blog")
      .option("-r, --render <list>", "What do you want rendered such as html or json (example --render html,json)")
      .option("-c, --config <path>", "custom configuration path")
      .action(async (options: any) => {
        try{
          await new SiteGenerator(options).run();
          this.result = true;
        } catch (error: any) {
          new ConsoleMessage().error('Error: '+ error.message);
        }
      })

    program
      .command('init')
      .description('Initialize a new Writr project')
      .argument('[name]', 'Name of the project', 'Blog')
      .action(async (name: string) => {
        try{
          await new Setup(name).init();
          this.result = true;
        } catch (error: any) {
          new ConsoleMessage().error('Error: '+ error.message);
        }
      })

    program
      .command('new')
      .description('Create new markdown file')
      .action(async() => {
        try{
          await new Setup('new').new();
          this.result = true;
        } catch (error: any) {
          new ConsoleMessage().error('Error: '+ error.message);
        }
      })

    program
      .command('migrate')
      .description('Migrate from different sources to Writr')
      .argument("<type> <options...>", "Provider type (jekyll, wordpress, etc), source and destination" )
      .action(async(options) => {
        try{
          const [type, src, dest] = options;
          await new Migrate(type).migrate(src, dest);
          this.result = true;
        } catch (error: any) {
          new ConsoleMessage().error('Error: '+ error.message);
        }
      })

    program
      .command('serve')
      .description('Serve the site locally')
      .option("-o, --output <path>", "Path of where to output the generated blog be served", 'blog_output')
      .option("-p, --port <port>", "Port to serve the site on", '3000')
      .option("--path <path>", "Path of where the blog, config, and template are located", './blog')
      .option("-w, --watch", "Watch for changes and rebuild", false)
      .action(async(options: any) => {
        try{
          const params = options.opts();
          await new Serve(params).run();
          this.result = true;
        } catch (error: any) {
          new ConsoleMessage().error('Error: '+ error.message);
        }
      })

    program.parse(process.argv);

    return this.result;
  }
}
