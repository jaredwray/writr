import {createLogger, transports} from "winston";
import fetch from "node-fetch";
import {MigrationProviderInterface} from "./migrationProviderInterface";
import {Parser} from "../utils/parser";
import {StorageService} from "../storage/storageService";

export class WordpressMigrationProvider implements MigrationProviderInterface{

    log: any;
    parser: any;
    storage: any;

    constructor() {
        this.log = createLogger({ transports: [new transports.Console()]});
        this.parser = new Parser();
        this.storage = new StorageService();
    }

    async fetchPosts(src: string) {
        try{
            let posts: Record<string, any>[];

            const data = await fetch(`${src}/wp-json/wp/v2/posts?page=1`);
            const pages = <string>data.headers.get('X-WP-TotalPages');
            posts = await data.json();

            const leftPages = (new Array(parseInt(pages)-1)).fill('page');

            const postPromises = leftPages.map(async (_, i) => {
                const data = await fetch(`${src}/wp-json/wp/v2/posts?page=${i+2}`);
                return await data.json()
            });

            const postsArray = await Promise.all(postPromises);
            const postsArrayFlat = postsArray.flat();

            posts = [...posts, ...postsArrayFlat];

            return posts;
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async fetchMedia(src: string) {
        try{
            const data = await fetch(`${src}/wp-json/wp/v2/media`);
            return await data.json();
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async fetchCategories(src: string){
        try{
            const data = await fetch(`${src}/wp-json/wp/v2/categories`);
            return await data.json();
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async migrate(src: string, dest: string): Promise<boolean>{
        this.log.info("Migrating WordPress site from " + src + " to " + dest);
        try{
            const posts = await this.fetchPosts(src);
            for (const post of posts) {
                const {title, slug, content } = post;
                const header = this.parser.generateMdHeaders({title: title.rendered, slug});
                const postContent = this.parser.htmlToMd(content.rendered);
                const mdContent = `${header}\n\n${postContent}`;
                await this.storage.set(`${dest}/${slug}.md`, mdContent);
            }
            return true;
        }catch (error: any) {
            throw new Error('Error while migrating WordPress site: ' + src);
        }
    }

}
