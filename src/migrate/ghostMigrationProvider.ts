import axios from "axios";
import {ConsoleMessage} from "../log";
import {MigrationProviderInterface} from "./migrationProviderInterface";
import {Parser} from "../utils/parser";
import {StorageService} from "../storage/storageService";

export class GhostMigrationProvider implements MigrationProviderInterface {

  parser: any;
  storage: any;

  constructor() {
    this.parser = new Parser();
    this.storage = new StorageService();
  }

  async fetchPosts(src: string) {
    try{
      const url = new URL(src);
      const { searchParams, origin } = url;
      const key = searchParams.get('key');

      let totalPosts: Record<string, any>[];

      const { posts, meta } = (await axios.get(`${origin}/ghost/api/v2/content/posts/?key=${key}`)).data;
      totalPosts = [...posts];

      const { pagination: { pages } } = meta;

      for(let i = 2; i <= pages; i++) {
        const { posts } = (await  axios.get(`${origin}/ghost/api/v2/content/posts/?key=${key}&page=${i}`)).data;
        totalPosts = totalPosts.concat(posts);
      }

      return totalPosts;

    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async saveMedia(mediaFetched: any, dest: string) {
    const { mediaUrl, slug } = mediaFetched;
    const response: Record<string, any> = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    // const { rawBody: media, headers } = response;
    const { data: media, headers } = response;
    const mime_type = headers['content-type'];
    const extension = mime_type!.split('/')[1];
    const filename = `${slug}.${extension}`;
    const mediaBuffer = Buffer.from(media, 'binary').toString('base64')
    await this.storage.set(`${dest}/images/${filename}`, mediaBuffer);
    return `/images/${filename}`;
  }

  async migrate(src: string, dest: string) {
    try{
      new ConsoleMessage().info('Migrating from Ghost to Writr');
      const posts = await this.fetchPosts(src);

      for (const post of posts) {
        const { title, slug, html, feature_image, published_at } = post;

        // Markdown header generation
        let mdContent = this.parser.generateMdHeaders({title, slug, date: published_at});

        if(feature_image) {
          const mediaPath = await this.saveMedia({ mediaUrl: feature_image, slug}, dest);
          mdContent += `![${title}](${mediaPath})\n\n`;
        }

        // Markdown html content
        mdContent += this.parser.htmlToMd(html);

        await this.storage.set(`${dest}/${slug}.md`, mdContent);
      }
      new ConsoleMessage().info("Migration was completed successfully");
      return true;
    } catch (error: any) {
      throw new Error('Error while migrating Ghost site: ' + src)
    }
  }

}
