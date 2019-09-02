import { Config } from "./config";
import { DataService } from "./data/dataService";
import { Logger, transports } from "winston";
import { HtmlProvider } from "./render/htmlProvider";

const program = require("commander");

const log = new Logger({ transports: [new transports.Console()] });

let __configPath = "writr.json";

let __config: Config;
let __dataStore: DataService;

program.option('-c, --config <path>', 'custom configuration path');
program.option('-o, --output <path>', 'path to output generated files');
program.option('-json, --json <file_name>', 'out put writr.json (Default) file of all posts and tags');

program.parse(process.argv);


//get configuration
if (program.config) {
  __configPath = program.config;
}

log.info("using configation file: " + __configPath);

__config = new Config();
__config.load(__configPath);
__config.program = program;

__dataStore = new DataService(__config);

let htmlProvider = new HtmlProvider();

htmlProvider.render(__dataStore, __config).then(() => {
  process.exit();
  log.info("Done!");
});


