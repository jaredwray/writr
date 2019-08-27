import * as handlebars from "handlebars";
import * as fs from "fs-extra";
import { Logger, transports } from "winston";
import * as del from "del";

import { DataService } from "../data/dataService";
import { Config } from "../config";
import { Post } from "../post";
import { Tag } from "../tag";

export class HtmlProvider {
    log: any;

    config: Config;
    dataStore: DataService;

    constructor(dataStore: DataService, config: Config) {
        this.log = new Logger({ transports: [new transports.Console()] });

        this.dataStore = dataStore;
        this.config = config;
    }

    async render(output: string): Promise<Boolean | undefined> {
        let result: Boolean | undefined;

        if (fs.existsSync(output)) {
            del.sync(output);
        }

        fs.ensureDirSync(output);

        //home
        fs.writeFileSync(output + "/index.html", await this.renderHome());

        //posts
        let posts = await this.dataStore.getPosts();

        posts.forEach(async post => {
            let postHtml = await this.renderPost(post);

            let postPath = output + "/" + post.getUrlName();
            fs.ensureDirSync(postPath);

            fs.writeFileSync(postPath + "/index.html", postHtml);
        });

        //tags
        fs.ensureDirSync(output + "/tags/");

        let tags = await this.dataStore.getTags();

        tags.forEach(async tag => {
            let tagHtml = await this.renderTag(tag);

            let tagPath = output + "/tags/" + tag.getUrlName();

            fs.ensureDirSync(tagPath);

            fs.writeFileSync(tagPath + "/index.html", tagHtml);
        });

        return result;
    }

    //render
    async renderHome(): Promise<string> {
        let result = "";

        let postList = await this.dataStore.getPublishedPosts();
        let tagList = await this.dataStore.getPublishedTags();

        let source: string = this.getHomeTemplate();
        result = this.renderTemplate(source, { tags: tagList, posts: postList });

        return result;
    }

    async renderTag(tag: Tag): Promise<string> {
        let result = "";
        if (tag) {
            let source = this.getTagTemplate();

            result = this.renderTemplate(source, tag);
        }
        return result;
    }

    async renderPost(post: Post): Promise<string> {
        let result = "";

        if (post) {
            let source: string = this.getPostTemplate();
            result = this.renderTemplate(source, post);
        }

        return result;
    }

    renderTemplate(source: string, data: object): string {
        let result = "";

        let template: handlebars.Template = handlebars.compile(source);
        result = template(data);

        return result;
    }

    //Templates
    getPostTemplate(): string {
        let result = "";

        result = fs.readFileSync(this.config.data.templatePath + "/post.hjs").toString();

        return result;
    }

    getTagTemplate(): string {
        let result = "";

        result = fs.readFileSync(this.config.data.templatePath + "/tag.hjs").toString();

        return result;
    }

    getHomeTemplate(): string {
        let result = "";

        result = fs.readFileSync(this.config.data.templatePath + "/index.hjs").toString();

        return result;
    }
}
