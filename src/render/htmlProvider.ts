import * as handlebars from "handlebars";
import * as fs from "fs-extra";
import { Logger, transports } from "winston";

import { DataService } from "../data/dataService";
import { Config } from "../config";
import { Post } from "../post";
import { Tag } from "../tag";
import { RenderProviderInterface } from "./renderProviderInterface";

export class HtmlProvider implements RenderProviderInterface {
    log: any;

    constructor() {
        this.log = new Logger({ transports: [new transports.Console()] });
    }

    async render(dataStore: DataService, config: Config): Promise<boolean | undefined> {
        let result: boolean  = true;

        let output = config.output;

        fs.ensureDirSync(output);

        //images
        fs.ensureDirSync(output + "/images");
        fs.copySync(config.path + "/images" , output + "/images");

        //home
        fs.writeFileSync(output + "/index.html", await this.renderHome(dataStore, config));

        let posts = await dataStore.getPosts();
        let tags = await dataStore.getTags();

        //posts

        posts.forEach(async post => {
            let postHtml = await this.renderPost(post, tags, config);

            let postPath = output + "/" + post.id;
            fs.ensureDirSync(postPath);

            fs.writeFileSync(postPath + "/index.html", postHtml);
        });

        //tags
        fs.ensureDirSync(output + "/tags/");

        

        tags.forEach(async tag => {
            let tagHtml = await this.renderTag(tag, config);

            let tagPath = output + "/tags/" + tag.id;

            fs.ensureDirSync(tagPath);

            fs.writeFileSync(tagPath + "/index.html", tagHtml);
        });

        return result;
    }

    //render
    async renderHome(dataStore: DataService, config:Config): Promise<string> {
        let result = "";

        let postList = await dataStore.getPostsByCount(config.indexCount);
        let tagList = await dataStore.getTags();

        let source = this.getHomeTemplate(config);
        result = this.renderTemplate(source, { tags: tagList, posts: postList }, config);

        return result;
    }

    async renderTag(tag: Tag, config:Config): Promise<string> {
        let result = "";
        if (tag) {
            let source = this.getTagTemplate(config);

            result = this.renderTemplate(source, tag, config);
        }
        return result;
    }

    async renderPost(post: Post, tags: Array<Tag>, config:Config): Promise<string> {
        let result = "";

        if (post) {
            let source: string = this.getPostTemplate(config);
            result = this.renderTemplate(source, { post: post, tags: tags }, config);
        }

        return result;
    }

    renderTemplate(source: string, data: any, config: Config): string {
        let result = "";

        data.writr = config;
        data.today = new Date();

        let template: handlebars.Template = handlebars.compile(source);
        result = template(data);

        return result;
    }

    //Templates
    getPostTemplate(config: Config): string {
        let result = "";

        result = fs.readFileSync(config.path + "/templates/" + config.template + "/post.hjs").toString();

        return result;
    }

    getTagTemplate(config: Config): string {
        let result = "";

        result = fs.readFileSync(config.path + "/templates/" + config.template + "/tag.hjs").toString();

        return result;
    }

    getHomeTemplate(config: Config): string {
        let result = "";

        result = fs.readFileSync(config.path + "/templates/" + config.template + "/index.hjs").toString();

        return result;
    }
}
