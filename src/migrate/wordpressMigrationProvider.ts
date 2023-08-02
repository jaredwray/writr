import axios from "axios";
import {MigrationProviderInterface} from "./migrationProviderInterface.js";
import {Parser} from "../utils/parser.js";
import {StorageService} from "../storage/storageService.js";
import {ConsoleMessage} from "../log.js";

export class WordpressMigrationProvider implements MigrationProviderInterface{

    parser: any;
    storage: any;

    constructor() {
        this.parser = new Parser();
        this.storage = new StorageService();
    }

    async fetchPosts(src: string) {
        try{
            let posts: Record<string, any>[];

            const response = await axios.get(`${src}/wp-json/wp/v2/posts?page=1`);
            const headers = response.headers;
            const body = typeof response.data == 'string' ? JSON.parse(response.data) : response.data;
            const pages = <string>headers['x-wp-totalpages'];
            posts = [...body as unknown as Record<string, any>[]];
            for(let i = 2; i <= parseInt(pages); i++){
                const body = (await axios.get(`${src}/wp-json/wp/v2/posts?page=${i}`)).data;
                posts = posts.concat(body as unknown as Record<string, any>[]);
            }
            return posts;
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    async fetchMedia(src: string, id: string) {
        try{
            return (await axios.get(`${src}/wp-json/wp/v2/media/${id}`)).data
        } catch (error: any) {
            return null;
        }
    }

    async saveMedia(mediaFetched: any, dest: string) {
        try{
            if (!mediaFetched) return null;
            const {source_url, slug, mime_type} = mediaFetched;
            const encodedURI = encodeURI(source_url);
            const response = await axios.get(encodedURI, { responseType: 'arraybuffer' });
            const { data: media, headers } = response;
            const mediaBuffer = Buffer.from(media, 'binary').toString('base64')
            const extension = mime_type.split('/')[1];
            const filename = `${slug}.${extension}`;
            await this.storage.set(`${dest}/images/${filename}`, mediaBuffer);
            return `/images/${filename}`;
        } catch (error: any) {
            return null
        }
    }

    async fetchCategoriesPerPost(src: string, postId: string): Promise<Record<string, any>[]> {
        try{
            return (await axios.get(`${src}/wp-json/wp/v2/categories?post=${postId}`)).data
        } catch (error: any) {
            return [];
        }
    }

    async fetchTagsPerPost(src: string, postId: string): Promise<Record<string, any>[]> {
        try{
            return (await axios.get(`${src}/wp-json/wp/v2/tags?post=${postId}`)).data;
        } catch (error: any) {
            return [];
        }
    }

    async migrate(src: string, dest: string): Promise<boolean>{
        new ConsoleMessage().info("Migrating WordPress site from " + src + " to " + dest);
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
                let mdContent = this.parser.generateMdHeaders({
                    title: title.rendered, slug, categories, tags, date
                });

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
            new ConsoleMessage().info("Migration was completed successfully");
            return true;
        }catch (error: any) {
            throw new Error('Error while migrating WordPress site: ' + src);
        }
    }

}
