import { RenderProviderInterface } from "./renderProviderInterface.js";
import { DataService } from "../data/dataService.js";
import { Config } from "../config.js";
import { Post } from "../post.js";
import { Tag } from "../tag.js";
import { StorageService } from "../storage/storageService.js";
import {ConsoleMessage} from "../log.js";

export class JSONRenderProvider implements RenderProviderInterface {
    log: any;

    constructor() {
        this.log = new ConsoleMessage();
    }

    async render(data: DataService, config: Config): Promise<boolean | undefined>  {
        let obj: any = {};
        obj.posts = new Array<Post>();
        obj.tags = new Array<Tag>();

        let posts = await data.getPosts();
        let tags = await data.getTags();

        for (let post of posts) {
            let postObj: any = await post.toObject();
            obj.posts.push(postObj);
        }

        for (let tag of tags) {
            obj.tags.push(await tag.toObject());
        }

        await new StorageService().set(config.output + "/data.json", JSON.stringify(obj));

        return true;
    }
}
