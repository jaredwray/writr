
import {Post} from './classes/post';
import {Tag} from './classes/tag';
import {Config} from './classes/config';
import { Logger, transports } from 'winston';
import * as express from "express";
import * as handlebars from 'handlebars';
import * as fs from 'fs';

const log = new Logger({transports:[new transports.Console()]});
let __config: Config = new Config();
const Posts = new Array<Post>();

export function initExpress(url: string, express: express.Application, config: Config): void {
    init(config);

    //handle home
    express.get('url', function(req: express.Request, res: express.Response){
        let body = renderHome();

        res.send(body);
    });

    //handle posts
    express.get(url+ '/:postID', function(req: express.Request, res: express.Response){
        let postID = req.params.postID;

        if(postID) {
            let body = renderTag(postID);

            res.send(body);

        } else {
            res.sendStatus(404);
            res.end();
        }

    });

    //handle tags
    express.get(url + '/tags/:tagID', function(req: express.Request, res: express.Response){
        
        let tagID = req.params.tagID;

        if(tagID) {
            let body = renderTag(tagID);

            res.send(body);

        } else {
            res.sendStatus(404);
            res.end();
        }
    });


    
}

export function init(config: Config) : void {

    __config = config;
}

//render
export function renderHome(): string {
    let result = '';

    let postList = getPublishedPosts();
    let tagList = getPublishedTags();

    let source: string = getHomeTemplate();
    result = render(source, {tags: tagList, posts: postList});

    return result;
}

export function renderTag(tagName:string): string {
    let result = '';

    let tag = getPublishedTag(tagName.toLowerCase().trim());

    if(tag) {
        let source: string = getTagTemplate();
        result = render(source, tag);
    }

    return result;
}

export function renderPost(postID:string) : string {
    let result = '';

    let post = getPublishedPost(postID);

    if(post) {
    let source: string = getPostTemplate();
    result = render(source, post);
    }

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

    if(Posts.length == 0) {
        let directory = __config.postPath;

        if(fs.existsSync(directory)) {
            let files = fs.readdirSync(directory);

            files.forEach(file => {
                if(file.indexOf('.md') > 0) {
                    let filePath = directory + '/' + file;
                    let post = new Post(filePath);
                        Posts.push(post);
                }
            });
        }
    }

    result = Posts;

    return result;
}

export function getPublishedPosts() : Array<Post> {
    let result = new Array<Post>();
    let directory = __config.postPath;

    if(fs.existsSync(directory)) {
        let files = fs.readdirSync(directory);

        files.forEach(file => {
            if(file.indexOf('.md') > 0) {
                let filePath = directory + '/' + file;
                let post = new Post(filePath);
                if(post.isPublished()) {
                    result.push(post);
                }
            }
        });
    }

    return result;
}

export function getPublishedPost(postID:string): Post | null {
    let result: Post | null = null;

    let posts = getPublishedPosts();

    posts.forEach(post => {
        
        if(post.url.toLowerCase().trim() == postID.toLowerCase().trim()) {
            result = post;
        }
    });

    return result;
};

//tags
export function generateTags(posts: Array<Post>): Array<Tag> {
    
    let result = new Array<Tag>();

    posts.forEach( post => {
        post.tags.forEach( tagName => {
            
            let tag = null;

            result.forEach(t => {
                if(t.name.toLowerCase().trim() == tagName.toLowerCase().trim()) {
                    tag = t;
                }
            });

            if(tag == null) {
                tag = new Tag(tagName);
                result.push(tag);
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
    });

    return result;
}

export function getTags() : Array<Tag> {
    let posts = getPosts();

    return generateTags(posts);
}

export function getPublishedTags() : Array<Tag> {
    let posts = getPublishedPosts();

    return generateTags(posts);
}

export function getTag(name: string) : Tag | null {
    let result: Tag | null = null;

    let tags = getTags();

    tags.forEach(tag => {
        if(tag.name.toLowerCase().trim() == name.toLowerCase().trim()) {
            result = tag;
        }
    });

    return result;
};

export function getPublishedTag(name: string) : Tag | null {
    let result: Tag | null = null;

    let tags = getPublishedTags();

    tags.forEach(tag => {
        if(tag.name.toLowerCase().trim() == name.toLowerCase().trim()) {
            result = tag;
        }
    });

    return result;
};

//Templates
export function getPostTemplate(): string {
    let result = '';

    result = fs.readFileSync(__config.templatePath + '/post.hjs').toString();

    return result;
}

export function getTagTemplate(): string {
    let result = '';

    result = fs.readFileSync(__config.templatePath + '/tag.hjs').toString();

    return result;
}

export function getHomeTemplate(): string {
    let result = '';

    result = fs.readFileSync(__config.templatePath + '/home.hjs').toString();

    return result;
}

//Config
export function getConfig() : Config {
    return __config;
}