import { RenderProviderInterface } from "./renderProviderInterface";
import { DataService } from "../data/dataService";
import { Config } from "../config";
import { Logger, transports } from "winston";
import * as fs from "fs-extra";

export class JSONProvider implements RenderProviderInterface {
    log: any;

    constructor() {
        this.log = new Logger({ transports: [new transports.Console()] });
    }

    async render(dataStore: DataService, config: Config): Promise<boolean | undefined>  {
        let result: boolean = false;

        let data: any = {};

        data.posts = await dataStore.getPosts();
        data.tags = await dataStore.getTags();

        fs.ensureDirSync(config.program.output);
        fs.writeFileSync(config.program.output + "/data.json", JSON.stringify(data));
        result = true;

        return result;
    }
}