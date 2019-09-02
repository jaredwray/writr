import * as handlebars from "handlebars";
import * as fs from "fs-extra";
import { Logger, transports } from "winston";
import * as del from "del";

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

    async render(dataStore: DataService, config: Config): Promise<Boolean | undefined> {
        let result: Boolean  = true;

        let output = config.program.output;

        if (fs.existsSync(output)) {
            del.sync(output);
        }

        fs.ensureDirSync(output);

        //home
        fs.writeFileSync(output + "/index.html", await this.renderHome(dataStore, config));

        //posts
        let posts = await dataStore.getPosts();

        posts.forEach(async post => {
            let postHtml = await this.renderPost(post, config);

            let postPath = output + "/" + post.id;
            fs.ensureDirSync(postPath);

            fs.writeFileSync(postPath + "/index.html", postHtml);
        });

        //tags
        fs.ensureDirSync(output + "/tags/");

        let tags = await dataStore.getTags();

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

        let postList = await dataStore.getPosts();
        let tagList = await dataStore.getTags();

        let source = this.getHomeTemplate(config);
        result = this.renderTemplate(source, { tags: tagList, posts: postList });

        return result;
    }

    async renderTag(tag: Tag, config:Config): Promise<string> {
        let result = "";
        if (tag) {
            let source = this.getTagTemplate(config);

            result = this.renderTemplate(source, tag);
        }
        return result;
    }

    async renderPost(post: Post, config:Config): Promise<string> {
        let result = "";

        if (post) {
            let source: string = this.getPostTemplate(config);

            //fix to handle the body variable from markdown.
            source = source.replace("{{body}}", post.body);

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
    getPostTemplate(config: Config): string {
        let result = "";

        result = fs.readFileSync(config.data.templatePath + "/post.hjs").toString();

        return result;
    }

    getTagTemplate(config: Config): string {
        let result = "";

        result = fs.readFileSync(config.data.templatePath + "/tag.hjs").toString();

        return result;
    }

    getHomeTemplate(config: Config): string {
        let result = "";

        result = fs.readFileSync(config.data.templatePath + "/index.hjs").toString();

        return result;
    }
}
