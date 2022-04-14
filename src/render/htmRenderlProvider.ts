import * as fs from "fs-extra";
import {DataService} from "../data/dataService";
import {Config} from "../config";
import {Post} from "../post";
import {Tag} from "../tag";
import {RenderProviderInterface} from "./renderProviderInterface";
import {Ecto} from "ecto";
import { ConsoleMessage } from "../log";

const ecto = new Ecto({defaultEngine: "handlebars"});


export class HtmlRenderProvider implements RenderProviderInterface {
    log: any;

    constructor() {
        this.log = new ConsoleMessage();
        ecto.handlebars.opts = { allowProtoPropertiesByDefault: true }
        ecto.handlebars.engine.registerHelper('formatDate', require('helper-date'));
    }

    async render(data: DataService, config: Config): Promise<boolean | undefined> {
        let result: boolean  = true;

        let output = config.output;

        let posts = await data.getPublishedPosts();
        let unpublishedPosts = await data.getPosts();
        let tags = await data.getPublishedTags();
        let unpublishedTags = await data.getTags();

        //posts

        let previousPost: Post;
        let nextPost: Post;

        //published posts
        for (const post of posts) {
            const index = posts.indexOf(post);

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

            let postPath = output + "/" + post.id + "/index.html";
            await this.renderPost(post, tags, config, previousPost, nextPost, postPath);

        }

        //unpublished posts
        for (const post of unpublishedPosts) {
            const index = unpublishedPosts.indexOf(post);

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
                let postPath = output + "/" + post.id + "/index.html";
                await this.renderPost(post, unpublishedTags, config, previousPost, nextPost, postPath);
            }
        }

        //tags
        for (const tag of tags) {

            let tagOutputPath = output + "/tags/" + tag.id + "/index.html";

            await this.renderTag(tag, tags, config, tagOutputPath);

        }

        //home
        await this.renderHome(data, config, output + "/index.html");

        return result;
    }

    //render
    async renderHome(data: DataService, config:Config, outputPath?:string): Promise<string> {

        let postList = await data.getPublishedPostsByCount(config.indexCount);
        let tagList = await data.getPublishedTags();
        let dataObject = { tags: tagList, posts: postList };
        let rootTemplatePath = config.path + "/templates/";

        let templateName = await this.getTemplatePath(config.path + "/templates", "index");

        let homeTemplatePath = rootTemplatePath + templateName;

        return await ecto.renderFromFile(homeTemplatePath, dataObject, rootTemplatePath, outputPath);
    }

    async renderTag(tag: Tag, tags: Array<Tag>, config:Config, outputPath?:string): Promise<string> {
        let result = "";
        if (tag) {
            let dataObject = {tag: tag, tags: tags};
            let rootTemplatePath = config.path + "/templates/";
            let templateName = await this.getTemplatePath(config.path + "/templates", "tag");
            let templatePath = rootTemplatePath + templateName;

            result = await ecto.renderFromFile(templatePath, dataObject, rootTemplatePath, outputPath);
        }
        return result;
    }

    async renderPost(post: Post, tags: Array<Tag>, config:Config, previousPost?: Post, nextPost?: Post, outputPath?:string): Promise<string> {
        let result = "";

        if (post) {

            let dataObject = { post: await post.toObject(), previousPost: previousPost, nextPost: nextPost, tags: tags };
            let rootTemplatePath = config.path + "/templates/";
            let templateID = "post";
            if(post.matter.layout) {
                templateID = post.matter.layout;
            }

            let templateName = await this.getTemplatePath(config.path + "/templates", templateID);
            let templatePath = rootTemplatePath + templateName;

            result = await ecto.renderFromFile(templatePath, dataObject, rootTemplatePath, outputPath);
       }

        return result;
    }

    async getTemplatePath(templatesPath:string, templateName:string): Promise<string> {
        let result = "";

        let templates = await fs.readdir(templatesPath);

        templates.forEach((file) => {

            if(file.split(".")[0].toLowerCase() === templateName.toLowerCase()) {
                result = file;
            }
        });

        return result;
    }
}
