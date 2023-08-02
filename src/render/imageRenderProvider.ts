import { DataService } from "../data/dataService.js";
import { Config } from "../config.js";
import { RenderProviderInterface } from "./renderProviderInterface.js";
import { StorageService } from "../storage/storageService.js";
import {ConsoleMessage} from "../log.js";

export class ImageRenderProvider implements RenderProviderInterface {
    log: any;

    constructor() {
        this.log = new ConsoleMessage();
    }

    async render(data: DataService, config: Config): Promise<boolean | undefined> {
        let result: boolean  = true;

        let output = config.output;

        //images
        await new StorageService().copy(config.path + "/images" , output + "/images");

        return result;
    }
}
