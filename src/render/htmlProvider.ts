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

        let posts = await dataStore.getPublishedPosts();
        let unpublishedPosts = await dataStore.getPosts();
        let tags = await dataStore.getPublishedTags();
        let unpublishedTags = await dataStore.getTags();

        //posts

        let previousPost: Post;
        let nextPost: Post;

        //published posts
        posts.forEach(async (post, index) => {

            if(index === 0) {
                previousPost = posts[posts.length-1];
            } else {
                previousPost = posts[index-1];
            }

            if(index === posts.length-1) {
                nextPost = posts[0];
            } else {
                nextPost = posts[index+1]
            }

            let postHtml = await this.renderPost(post, previousPost, nextPost, tags, config);

            let postPath = output + "/" + post.id;
            fs.ensureDirSync(postPath);

            fs.writeFileSync(postPath + "/index.html", postHtml);
        });

        //unpublished posts
        unpublishedPosts.forEach(async (post, index) => {

            if(index === 0) {
                previousPost = posts[posts.length-1];
            } else {
                previousPost = posts[index-1];
            }

            if(index === posts.length-1) {
                nextPost = posts[0];
            } else {
                nextPost = posts[index+1]
            }

            if(post.published === false) {
                let postHtml = await this.renderPost(post, previousPost, nextPost, unpublishedTags, config);

                let postPath = output + "/" + post.id;
                fs.ensureDirSync(postPath);

                fs.writeFileSync(postPath + "/index.html", postHtml);
            }
        });

        //tags
        fs.ensureDirSync(output + "/tags/");

        tags.forEach(async tag => {
            let tagHtml = await this.renderTag(tag, tags, config);

            let tagPath = output + "/tags/" + tag.id;

            fs.ensureDirSync(tagPath);

            fs.writeFileSync(tagPath + "/index.html", tagHtml);
        });

        //home
        fs.writeFileSync(output + "/index.html", await this.renderHome(dataStore, config));

        return result;
    }

    //render
    async renderHome(dataStore: DataService, config:Config): Promise<string> {
        let result = "";

        let postList = await dataStore.getPublishedPostsByCount(config.indexCount);
        let tagList = await dataStore.getPublishedTags();

        let source = this.getHomeTemplate(config);
        result = this.renderTemplate(source, { tags: tagList, posts: postList }, config);

        return result;
    }

    async renderTag(tag: Tag, tags: Array<Tag>, config:Config): Promise<string> {
        let result = "";
        if (tag) {
            let source = this.getTagTemplate(config);

            result = this.renderTemplate(source, {tag: tag, tags: tags}, config);
        }
        return result;
    }

    async renderPost(post: Post, previousPost: Post, nextPost: Post, tags: Array<Tag>, config:Config): Promise<string> {
        let result = "";

        if (post) {
            let source: string = this.getPostTemplate(config);
            result = this.renderTemplate(source, { post: post, previousPost: previousPost, nextPost: nextPost, tags: tags }, config);
        }

        return result;
    }

    renderTemplate(source: string, data: any, config: Config): string {
        let result = "";
        let date = new Date();

        data.writr = config;

        handlebars.registerHelper('formatDate', require('helper-date'));
        let template: handlebars.Template = handlebars.compile(source);
        result = template(data);

        return result;
    }

    //Templates
    getPostTemplate(config: Config): string {
        let result = "";

        result = fs.readFileSync(config.path + "/templates/post.hjs").toString();

        return result;
    }

    getTagTemplate(config: Config): string {
        let result = "";

        result = fs.readFileSync(config.path + "/templates/tag.hjs").toString();

        return result;
    }

    getHomeTemplate(config: Config): string {
        let result = "";

        result = fs.readFileSync(config.path + "/templates/index.hjs").toString();

        return result;
    }
}
