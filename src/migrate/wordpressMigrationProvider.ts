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

            for(let i = 2; i <= parseInt(pages); i++){
                const data = await fetch(`${src}/wp-json/wp/v2/posts?page=${i}`);
                const pagePosts = await data.json();
                posts = posts.concat(pagePosts);
            }

            return posts;
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async fetchMedia(src: string, id: string) {
        try{
            const response = await fetch(`${src}/wp-json/wp/v2/media/${id}`);
            const {guid, slug, mime_type} = await response.json();
            const mediaResponse = await fetch(guid.rendered);
            const media = await mediaResponse.buffer();
            const extension = mime_type.split('/')[1];
            return { media, filename: `${slug}.${extension}` };
        } catch (error: any) {
            return {};
        }
    }

    async saveMedia(mediaFetched: any, dest: string) {
        try{
            const { media, filename } = mediaFetched;
            if(!media || !filename) return null;
            await this.storage.set(`${dest}/images/${filename}`, media);
            return `/images/${filename}`;
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async fetchCategoriesPerPost(src: string, postId: string) {
        try{
            const data = await fetch(`${src}/wp-json/wp/v2/categories?post=${postId}`);
            const categoriesData = await data.json();
            return categoriesData.map((category: any) => category.name);
        } catch (error: any) {
            return null;
        }
    }

    async migrate(src: string, dest: string): Promise<boolean>{
        this.log.info("Migrating WordPress site from " + src + " to " + dest);
        try{
            const posts = await this.fetchPosts(src);
            for (const post of posts) {
                const {id, title, slug, date, content, featured_media } = post;

                // Get post categories
                const categories = await this.fetchCategoriesPerPost(src, id);

                // Markdown header generation
                const header = this.parser.generateMdHeaders({
                    title: title?.rendered, slug, categories, date
                });
                let mdContent = `${header}\n\n`;

                // Markdown media content
                if(featured_media) {
                    const mediaFetched = await this.fetchMedia(src, featured_media);
                    const mediaPath = this.saveMedia(mediaFetched, dest);
                    mdContent += mediaPath ? `![${title.rendered}](${mediaPath})\n\n` : '';
                }

                // Markdown html content
                mdContent += this.parser.htmlToMd(content?.rendered);

                await this.storage.set(`${dest}/${slug}.md`, mdContent);
            }
            this.log.info("Migration was completed successfully");
            return true;
        }catch (error: any) {
            console.log('Error', error.message)
            throw new Error('Error while migrating WordPress site: ' + src);
        }
    }

}
