import { RenderProviderInterface } from "./renderProviderInterface";
import { DataService } from "../data/dataService";
import { Config } from "../config";
import { Logger, transports } from "winston";
import * as fs from "fs-extra";
import { Post } from "../post";
import { Tag } from "../tag";

export class JSONProvider implements RenderProviderInterface {
    log: any;

    constructor() {
        this.log = new Logger({ transports: [new transports.Console()] });
    }

    async render(dataStore: DataService, config: Config): Promise<boolean | undefined>  {
        let result: boolean = false;

        let data: any = {};
        data.posts = new Array<Post>();
        data.tags = new Array<Tag>();

        let posts = await dataStore.getPosts();
        let tags = await dataStore.getTags();

        posts.forEach((post) => {
            data.posts.push(post.toObject());
        });

        tags.forEach((tag) => {
            data.tags.push(tag.toObject());
        });

        fs.ensureDirSync(config.output);
        fs.writeFileSync(config.output + "/data.json", JSON.stringify(data));
        result = true;
        
        return result;
    }
}