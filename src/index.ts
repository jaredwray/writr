
import {Post} from './classes/post';
import {Tag} from './classes/tag';
import {Config} from './classes/config';
import {DataStore} from './services/dataStore';
import { Logger, transports } from 'winston';
import * as express from "express";
import * as handlebars from 'handlebars';
import * as fs from 'fs';

const log = new Logger({transports:[new transports.Console()]});
let __config: Config = new Config();
const Posts = new Array<Post>();
let __dataStore : DataStore = new DataStore(__config);

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

    __dataStore = new DataStore(__config);
}

//render
export function renderHome(): string {
    let result = '';

    let postList = __dataStore.getPublishedPosts();
    let tagList = __dataStore.getPublishedTags();

    let source: string = getHomeTemplate();
    result = render(source, {tags: tagList, posts: postList});

    return result;
}

export function renderTag(tagName:string): string {
    let result = '';

    let tag = __dataStore.getPublishedTag(tagName.toLowerCase().trim());

    if(tag) {
        let source: string = getTagTemplate();
        result = render(source, tag);
    }

    return result;
}

export function renderPost(postID:string) : string {
    let result = '';

    let post = __dataStore.getPublishedPost(postID);

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