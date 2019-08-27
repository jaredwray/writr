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
 
program.parse(process.argv);
 

//get configuration
if(program.config) {
  __configPath = program.config;
}

log.info("using configation file: " + __configPath);

__config = new Config();
__config.load(__configPath);

__dataStore = new DataService(__config);

let htmlProvider = new HtmlProvider(__dataStore, __config);



htmlProvider.render(program.output).then(() => {
  process.exit();
});


