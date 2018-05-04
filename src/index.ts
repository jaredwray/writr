
import {Post} from './classes/post';
import {Tag} from './classes/tag';
import {Config} from './classes/config';
import { Logger, transports } from 'winston';
import * as express from "express";
import * as handlebars from 'handlebars';
import * as fs from 'fs';

const log = new Logger({transports:[new transports.Console()]});
const Tags: Array<Tag> = new Array<Tag>();
let __config: Config = new Config();

export function initExpress(url: string, express: express.Application, config: Config): void {
    init(config);

    //handle home
    express.get('url', function(req: express.Request, res: express.Response){

    });

    //handle posts
    express.get(url+ '/:postID', function(req: express.Request, res: express.Response){

    });

    //handle tags
    express.get(url + '/tags/:tagID', function(req: express.Request, res: express.Response){

    });


    
}

export function init(config: Config) : void {

    __config = config;



}

//render
export function renderHome(): string {
    let result = '';

    let postList = new Array<Post>(); //TODO: FIX
    let tagList = getTags();

    let source: string = getPostTemplate();
    result = render(source, {tags: tagList, posts: postList});

    return result;
}

export function renderTag(tagName:string): string {
    let result = '';

    Tags.forEach( (t) => {
        if(t.name.toLowerCase().trim() == tagName.toLowerCase().trim()){
            let source: string = getTagTemplate();
            result = render(source, t);
        }
    });

    return result;
}

export function renderPost(post: Post) : string {
    let result = '';

    let source: string = getPostTemplate();
    result = render(source, post);

    return result;
}

export function render(source: string, data:object): string {
    let result = '';

    let template: handlebars.Template = handlebars.compile(source);
    result = template(data);

    return result;
}

//posts
export function getPosts() : Array<Post> {
    let result = new Array<Post>();
    let directory = __config.postPath;

    if(fs.existsSync(directory)) {
        let files = fs.readdirSync(directory);

        files.forEach(file => {
            if(file.indexOf('.md') > 0) {
                let filePath = directory + '/' + file;
                result.push(new Post(filePath));
            }
        });
    }

    return result;
}

//tags
export function saveTags(post: Post): void {
    
    post.tags.forEach( tagName => {
        let tag = getTag(tagName);

        if(tag == null) {
            tag = new Tag(tagName);
            Tags.push(tag);
        }

        let postExists : boolean = false;

        tag.posts.forEach(p => {
            if(p.title.toLowerCase().trim() == post.title.toLowerCase().trim()) {
                postExists = true;
            }
        })

        if(!postExists) {
            tag.posts.push(post);
        }
    });
}

export function getTags() : Array<Tag> {
    return Tags;
}

export function getTag(name: string) : Tag | null {
    let result: Tag | null = null;

    Tags.forEach(tag => {
        if(tag.name.toLowerCase().trim() == name.toLowerCase().trim()) {
            result = tag;
        }
    });

    return result;
};

export function tagExists(name:string) : Boolean {
    let result = false;

    if(getTag(name) != null) {
        result = true;
    }

    return result;
};


//Templates
export function getPostTemplate(): string {
    let result = '';

    result = fs.readFileSync(__dirname + __config.templatePath + '/post.hjs').toString();

    return result;
}

export function getTagTemplate(): string {
    let result = '';

    result = fs.readFileSync(__dirname + __config.templatePath + '/tag.hjs').toString();

    return result;
}

export function getHomeTemplate(): string {
    let result = '';

    result = fs.readFileSync(__dirname + __config.templatePath + '/home.hjs').toString();

    return result;
}

//Config
export function getConfig() : Config {
    return __config;
}