import * as handlebars from "handlebars";
import { createLogger, transports } from "winston";
import * as fs from "fs-extra";
import { DataService } from "../data/dataService";
import { Config } from "../config";
import { Post } from "../post";
import { Tag } from "../tag";
import { RenderProviderInterface } from "./renderProviderInterface";
import { StorageService } from "../storage/storageService";


export class HtmlRenderProvider implements RenderProviderInterface {
    log: any;

    constructor() {
        this.log = createLogger({ transports: [new transports.Console()]});

    }

    async render(data: DataService, config: Config): Promise<boolean | undefined> {
        let result: boolean  = true;

        let output = config.output;

        let posts = await data.getPublishedPosts();
        let unpublishedPosts = await data.getPosts();
        let tags = await data.getPublishedTags();
        let unpublishedTags = await data.getTags();

        let storage = new StorageService(config);

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

            await storage.set(postPath + "/index.html", postHtml);
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

                storage.set(postPath + "/index.html", postHtml);
            }
        });

        //tags

        tags.forEach(async tag => {
            let tagHtml = await this.renderTag(tag, tags, config);

            let tagPath = output + "/tags/" + tag.id;

            storage.set(tagPath + "/index.html", tagHtml);
        });

        //home
        storage.set(output + "/index.html", await this.renderHome(data, config));

        return result;
    }

    //render
    async renderHome(data: DataService, config:Config): Promise<string> {
        let result = "";

        let postList = await data.getPublishedPostsByCount(config.indexCount);
        let tagList = await data.getPublishedTags();

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
            if(post.matter.layout) {
                source = this.getTemplate(config, post.matter.layout);
            }
            result = this.renderTemplate(source, { post: post, previousPost: previousPost, nextPost: nextPost, tags: tags }, config);
        }

        return result;
    }

    renderTemplate(source: string, data: any, config: Config): string {
        let result = "";
        
        data.writr = config;

        this.registerPartials(config);

        handlebars.registerHelper('formatDate', require('helper-date'));
        let template: handlebars.Template = handlebars.compile(source);
        result = template(data);

        return result;
    }

    registerPartials(config: Config) {
        let result = false;
        let path = config.path + "/templates/partials";
        if(fs.pathExistsSync(path)) {
            let partials = fs.readdirSync(path);
            
            partials.forEach(p => {
                let source = fs.readFileSync(path + "/" + p).toString();
                let name = p.split(".hjs")[0];

                if(handlebars.partials[name] === undefined) {
                    handlebars.registerPartial(name, handlebars.compile(source));
                }

            });
            result = true;
        }

        return result;
    }

    //Templates
    getTemplate(config: Config, layout:string ): string {
        return fs.readFileSync(config.path + "/templates/" + layout + ".hjs").toString();
    }

    getPostTemplate(config: Config): string {
        let result = "";

        result = this.getTemplate(config, "post");

        return result;
    }

    getTagTemplate(config: Config): string {
        let result = "";

        result = this.getTemplate(config, "tag");

        return result;
    }

    getHomeTemplate(config: Config): string {
        let result = "";

        result = this.getTemplate(config, "index");

        return result;
    }
}
