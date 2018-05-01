import {Article} from './article';

export class Tag {
    name: string = '';
    articles: Array<Article> = new Array<Article>();

    constructor(name: string) {
        this.name = name;
    }
}