import {Config} from '../config';
import {Post} from '../post';
import {Tag} from '../tag';

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