import {Post} from './post';

export class Tag {
    name: string = '';
    posts: Array<Post> = new Array<Post>();

    constructor(name: string) {
        this.name = name;
    }

    isPublished() : boolean {
        let result = false;

        this.posts.forEach(post => {
            if(post.isPublished()) {
                result = true;
            }
        });

        return result;
    }
}