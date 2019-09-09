import * as handlebars from "handlebars";
import * as fs from "fs-extra";
import { Logger, transports } from "winston";

import { DataService } from "../data/dataService";
import { Config } from "../config";
import { RenderProviderInterface } from "./renderProviderInterface";

export class ImageProvider implements RenderProviderInterface {
    log: any;

    constructor() {
        this.log = new Logger({ transports: [new transports.Console()] });
    }

    async render(dataStore: DataService, config: Config): Promise<boolean | undefined> {
        let result: boolean  = true;

        let output = config.output;

        fs.ensureDirSync(output);

        //images
        fs.ensureDirSync(output + "/images");
        fs.copySync(config.path + "/images" , output + "/images");

        return result;
    }
}