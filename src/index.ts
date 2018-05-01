
import {Article} from './classes/article';
import {Tag} from './classes/tag';
import {Config} from './classes/config';
import { Logger, transports } from 'winston';

const log = new Logger({transports:[new transports.Console()]});

export const Tags: Array<Tag> = new Array<Tag>();

export function initExpress(config: Config): void {


    init(config);
}

export function init(config: Config) : void {

    log.info('Initializing writer...');
    //loop through the directories creating {Article} objects. 
        //when you create the article add the tag to cache / memory and list all the articles

}

export function renderHome(): void {

}

export function renderTags(tagName:string): void {

}

export function renderArticle(article: Article) : void {

}

//tags
export function saveTags(article: Article): void {
    
}

export function getTags(): Array<string> {
    
    let result = new Array<string>();

    Tags.forEach( (t) => {
        result.push(t.name)
    })

    return result;
}

