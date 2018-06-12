import {Config} from '../classes/config';
import {Post} from '../classes/post';
import {Tag} from '../classes/tag';

export interface DataProviderInterface {
    getPost(id:string) : Promise<Post | undefined>;
    getPublishedPost(id:string): Promise<Post | undefined>;
    getPosts(): Promise<Array<Post>>;
    getPublishedPosts(): Promise<Array<Post>>;
    getTag(name:string) : Promise<Tag | undefined>;
    getPublishedTag(name:string): Promise<Tag | undefined>;
    getTags(): Promise<Array<Tag>>;
    getPublishedTags(): Promise<Array<Tag>>;
    init(config:Config): void;
}