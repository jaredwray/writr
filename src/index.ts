
import {Post} from './classes/post';
import {Tag} from './classes/tag';
import {Config} from './classes/config';
import { Logger, transports } from 'winston';
import * as express from "express";
import * as handlebars from 'handlebars';
import * as fs from 'fs';

const log = new Logger({transports:[new transports.Console()]});
const Tags: Array<Tag> = new Array<Tag>();
const config: Config = new Config();

export function initExpress(url: string, express: express.Application, config: Config): void {
    init(config);

    //handle posts
    express.get(url+ '/:postID', function(req: express.Request, res: express.Response){

    });

    //handle tags
    express.get(url + '/tags/:tagID', function(req: express.Request, res: express.Response){

    });


    
}

export function init(config: Config) : void {

    log.info('Initializing writer...');

    //loop through the directories creating {Post} objects. 
        //when you create the post add the tag to cache / memory and list all the posts

}

export function renderHome(): void {

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

//tags
export function saveTags(post: Post): void {
    
}

export function getTags(): Array<string> {
    
    let result = new Array<string>();

    Tags.forEach( (t) => {
        result.push(t.name)
    });

    return result;
}

export function getPostTemplate(): string {
    let result = '';

    result = fs.readFileSync(__dirname + config.templatePath + '/post.hjs').toString();

    return result;
}

export function getTagTemplate(): string {
    let result = '';

    result = fs.readFileSync(__dirname + config.templatePath + '/tag.hjs').toString();

    return result;
}

export function getHomeTemplate(): string {
    let result = '';

    result = fs.readFileSync(__dirname + config.templatePath + '/home.hjs').toString();

    return result;
}
