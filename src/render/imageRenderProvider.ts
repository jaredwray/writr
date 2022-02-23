import { createLogger, transports } from "winston";
import { DataService } from "../data/dataService";
import { Config } from "../config";
import { RenderProviderInterface } from "./renderProviderInterface";
import { StorageService } from "../storage/storageService";

export class ImageRenderProvider implements RenderProviderInterface {
    log: any;

    constructor() {
        this.log = createLogger({ transports: [new transports.Console()]});
    }

    async render(data: DataService, config: Config): Promise<boolean | undefined> {
        let result: boolean  = true;

        let output = config.output;

        //images
        await new StorageService().copy(config.path + "/images" , output + "/images");

        return result;
    }
}
