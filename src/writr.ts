import { Logger, transports } from "winston";
import { DataService } from "./data/dataService";
import { Config } from "./config";
import { HtmlProvider } from "./render/htmlProvider";

export class Writr {
    log: any;

    config: Config | undefined;
    dataStore: DataService | undefined;

    constructor() {
        this.log = new Logger({ transports: [new transports.Console()] });
    }

    parseCLI(process: NodeJS.Process) {
        const program = require("commander");

        program.option('-c, --config <path>', 'custom configuration path');
        program.option('-o, --output <path>', 'path to output generated files');
        program.option('-json, --json <file_name>', 'out put writr.json (Default) file of all posts and tags');

        program.parse(process.argv);

        this.config = new Config();
        this.config.program = program;

        if(program.config) {
            this.config.load(program.config);
        }

        this.dataStore = new DataService(this.config);
    }

    async runCLI(): Promise<boolean> {
        let result = true;

        if(this.dataStore !== undefined && this.config !== undefined) {
            let htmlProvider = new HtmlProvider();

            let render = await htmlProvider.render(this.dataStore, this.config);

            if(render) {
                result = render;
            }

        } else {
            result = false;
        }
        return result;
    }
}