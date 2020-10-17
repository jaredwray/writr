import { RenderProviderInterface } from "./renderProviderInterface";
import { DataService } from "../data/dataService";
import { Config } from "../config";
import { createLogger, transports } from "winston";
import { Post } from "../post";
import { Tag } from "../tag";
import { StorageService } from "../storage/storageService";

export class JSONRenderProvider implements RenderProviderInterface {
    log: any;

    constructor() {
        this.log = createLogger({ transports: [new transports.Console()]});
    }

    async render(data: DataService, config: Config): Promise<boolean | undefined>  {
        let result: boolean = false;

        let obj: any = {};
        obj.posts = new Array<Post>();
        obj.tags = new Array<Tag>();

        let posts = await data.getPosts();
        let tags = await data.getTags();

        posts.forEach((post) => {
            obj.posts.push(post.toObject());
        });

        tags.forEach((tag) => {
            obj.tags.push(tag.toObject());
        });
        
        await new StorageService(config).set(config.output + "/data.json", JSON.stringify(obj));
        
        result = true;
        
        return result;
    }
}