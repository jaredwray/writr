
import { DataService } from "../data/dataService";
import { Config } from "../config";

export interface RenderProviderInterface {
    render(dataStore: DataService, config: Config): Promise<Boolean | undefined>;
}