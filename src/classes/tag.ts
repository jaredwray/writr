import {Post} from './post';

export class Tag {
    name: string = '';
    articles: Array<Post> = new Array<Post>();

    constructor(name: string) {
        this.name = name;
    }
}