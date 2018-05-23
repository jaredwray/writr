import { Config } from "../classes/config";
import {Post} from '../classes/post';
import {Tag} from '../classes/tag';
import {DataProviderInterface}  from './dataProviderInterface';
import * as fs from 'fs';


export class FileDataProvider implements DataProviderInterface {
    __config: Config = new Config();
    __posts = new Array<Post>();

    constructor() {

    }

    getPost(id:string): Post | undefined {
        let result: Post | undefined;

        let posts = this.getPosts();
    
        posts.forEach(post => {
            
            if(post.id == this.formatToKey(id)) {
                result = post;
            }
        });
    
        return result;
    }

    getPublishedPost(id:string): Post | undefined {
        let result: Post | undefined;

        let posts = this.getPublishedPosts();
    
        posts.forEach(post => {
            
            if(post.id == this.formatToKey(id)) {
                result = post;
            }
        });
    
        return result;
    }

    getPosts(): Array<Post> {
        let result = new Array<Post>();

        if(this.__posts.length == 0) {
            let directory = this.__config.postPath;

            if(fs.existsSync(directory)) {
                let files = fs.readdirSync(directory);

                files.forEach(file => {
                    if(file.indexOf('.md') > 0) {
                        let filePath = directory + '/' + file;
                        let post = new Post(filePath);
                            this.__posts.push(post);
                    }
                });
            }
        }

        result = this.__posts;

        return result;
    }

    getPublishedPosts(): Array<Post> {
        let result = new Array<Post>();

        this.getPosts().forEach(post => {
            if(post.isPublished()) {
                result.push(post);
            }
        });

        return result;
    }

    getTag(name:string) : Tag | undefined {
        let result;

        this.getTags().forEach(tag => {
            if(this.formatToKey(tag.name) == this.formatToKey(name)) {
                result = tag;
            }
        });

        return result;
    }
    
    getPublishedTag(name:string): Tag | undefined {
        let result;

        this.getPublishedTags().forEach(tag => {
            if(this.formatToKey(tag.name) == this.formatToKey(name)) {
                result = tag;
            }
        });

        return result;
    }

    getTags(): Array<Tag> {
        let posts = this.getPosts();

        return this.generateTags(posts);
    }

    getPublishedTags(): Array<Tag> {
        let posts = this.getPublishedPosts();

        return this.generateTags(posts);
    }

    generateTags(posts: Array<Post>): Array<Tag> {
    
        let result = new Array<Tag>();
    
        posts.forEach( post => {
            post.tags.forEach( tagName => {
                
                let tag = null;
    
                result.forEach(t => {
                    if(this.formatToKey(t.name) == this.formatToKey(tagName)) {
                        tag = t;
                    }
                });
    
                if(tag == null) {
                    tag = new Tag(tagName);
                    result.push(tag);
                }
    
                let postExists : boolean = false;
    
                tag.posts.forEach(p => {
                    if(this.formatToKey(p.title) == this.formatToKey(post.title)) {
                        postExists = true;
                    }
                })
    
                if(!postExists) {
                    tag.posts.push(post);
                }
            
            });
        });
    
        return result;
    }

    init(config:Config): void {
        this.__config = config;
    }

    formatToKey(key:string): string {
        return key.toLowerCase().trim();
    }

}