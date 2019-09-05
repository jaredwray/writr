import { Logger, transports } from "winston";
import { DataService } from "../data/dataService";
import { Config } from "../config";
import { RenderProviderInterface } from "./renderProviderInterface";
import * as fs from "fs-extra";

export class AtomProvider implements RenderProviderInterface{
    log: any;
    constructor() {
        this.log = new Logger({ transports: [new transports.Console()] });
    }

    async render(dataStore: DataService, config: Config): Promise<boolean> {
        let result = true;

        let AtomFeed = require("feed").Feed;

        fs.ensureDirSync(config.output);

        let feedConfig: any = {};

        if(config.title) {
            feedConfig.title = config.title;
        }
        
        feedConfig.generator = "Writr";

        if(config.url) {
            feedConfig.id = config.url + "/atom.xml";
            feedConfig.link = config.url + "/atom.xml";
            feedConfig.favicon = config.url + "/favicon.ico";

            feedConfig.feedLinks = {
                atom: config.url + "/atom.xml"
            }
        }

        feedConfig.author = {};

        if(config.authorName) {
            feedConfig.author.name = config.authorName;
        }

        if(config.authorEmail) {
            feedConfig.author.email = config.authorEmail;
        }

        feedConfig.copyright = new Date().getFullYear().toString() + " All Rights Reserved";

        let atomFeed = new AtomFeed(feedConfig);

        //add in the posts
        let posts = await dataStore.getPosts();

        posts.forEach((post) => {

            let feedPost: any = {};
            feedPost.title = post.title;
            feedPost.id = config.url + "/" + post.url;
            feedPost.link = config.url + "/" + post.url;
            feedPost.description = post.body;
            feedPost.content = post.body;
            feedPost.author = feedConfig.author;
            feedPost.date = post.date;

            atomFeed.addItem(feedPost);
        });

        //write the feed atom.xml
        fs.writeFileSync(config.output + "/atom.xml", atomFeed.atom1());

        return result;
    }
}