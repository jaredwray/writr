import {Post} from './post';

export class Tag {
    name: string = '';
    posts: Array<Post> = new Array<Post>();

    constructor(name: string) {
        this.name = name;
    }
}