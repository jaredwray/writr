import { Config } from "./config";
import { DataService } from "./data/dataService";
import { Logger, transports } from "winston";

const program = require("commander");

const __log = new Logger({ transports: [new transports.Console()] });

let __configPath = "writr.json";

let __config: Config;
let __dataStore: DataService;

program.option('-c, --config <path>', 'custom configuration path');
 
program.parse(process.argv);
 

//get configuration
if(program.config) {
  __configPath = program.config;
}

__log.info("using configation file: " + __configPath);

__config = new Config();