
import { DataService } from "../data/dataService.js";
import { Config } from "../config.js";

export interface RenderProviderInterface {
    render(data: DataService, config: Config): Promise<Boolean | undefined>;
}