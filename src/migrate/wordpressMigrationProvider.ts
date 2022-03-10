import {createLogger, transports} from "winston";
import axios from "axios";
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

            const response = await axios(`${src}/wp-json/wp/v2/posts?page=1`);
            const pages = <string>response.headers['x-wp-totalpages'];
            posts = response.data;

            for(let i = 2; i <= parseInt(pages); i++){
                const pageData = await axios(`${src}/wp-json/wp/v2/posts?page=${i}`);
                const pagePosts = await pageData.data;
                posts = posts.concat(pagePosts);
            }
            return posts;
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async fetchMedia(src: string, id: string) {
        try{
            const { data } = await axios(`${src}/wp-json/wp/v2/media/${id}`);
            return data;
        } catch (error: any) {
            return null;
        }
    }

    async saveMedia(mediaFetched: any, dest: string) {
        try{
            if (!mediaFetched) return null;
            const {source_url, slug, mime_type} = mediaFetched;
            const encodedURI = encodeURI(source_url);
            const mediaResponse = await axios(encodedURI, { responseType: 'arraybuffer' });
            const media = await mediaResponse.data
            const extension = mime_type.split('/')[1];
            const filename = `${slug}.${extension}`;
            await this.storage.set(`${dest}/images/${filename}`, media);
            return `/images/${filename}`;
        } catch (error: any) {
            return null
        }
    }

    async fetchCategoriesPerPost(src: string, postId: string) {
        try{
            const { data } = await axios(`${src}/wp-json/wp/v2/categories?post=${postId}`);
            return data
        } catch (error: any) {
            return null;
        }
    }

    async fetchTagsPerPost(src: string, postId: string){
        try{
            const { data } = await axios(`${src}/wp-json/wp/v2/tags?post=${postId}`);
            return data;
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
                const categoriesData = await this.fetchCategoriesPerPost(src, id);
                const tagsData = await this.fetchTagsPerPost(src, id);
                const categories = categoriesData.map((category: any) => category.name);
                const tags = tagsData.map((tag: any) => tag.name);
                // Markdown header generation
                const header = this.parser.generateMdHeaders({
                    title: title.rendered, slug, categories, tags, date
                });
                let mdContent = `${header}\n\n`;

                // Markdown media content
                if(featured_media) {
                    const mediaFetched = await this.fetchMedia(src, featured_media);
                    const mediaPath = await this.saveMedia(mediaFetched, dest);
                    mdContent += `![${title.rendered}](${mediaPath})\n\n`;
                }

                // Markdown html content
                mdContent += this.parser.htmlToMd(content.rendered);

                await this.storage.set(`${dest}/${slug}.md`, mdContent);
            }
            this.log.info("Migration was completed successfully");
            return true;
        }catch (error: any) {
            throw new Error('Error while migrating WordPress site: ' + src);
        }
    }

}
