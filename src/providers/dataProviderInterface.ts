import {Config} from '../classes/config';
import {Post} from '../classes/post';
import {Tag} from '../classes/tag';

export interface DataProviderInterface {
    getPost(id:string) : Post | undefined;
    getPublishedPost(id:string): Post | undefined;
    getPosts(): Array<Post>;
    getPublishedPosts(): Array<Post>;
    getTag(name:string) : Tag | undefined;
    getPublishedTag(name:string): Tag | undefined;
    getTags(): Array<Tag>;
    getPublishedTags(): Array<Tag>;
    init(config:Config): void;
}