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

      const initialData = await axios(`${origin}/ghost/api/v2/content/posts/?key=${key}`);
      const { posts, meta } = await initialData.data;
      totalPosts = [...posts];

      const { pagination: { pages } } = meta;

      for(let i = 2; i <= pages; i++) {
        const { data } = await axios(`${origin}/ghost/api/v2/content/posts/?key=${key}&page=${i}`);
        const { posts } = data;
        totalPosts = totalPosts.concat(posts);
      }

      return totalPosts;

    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async saveMedia(mediaFetched: any, dest: string) {
    const { mediaUrl, slug } = mediaFetched;
    const response = await axios(mediaUrl, { responseType: 'arraybuffer' });
    const media = await response.data;
    const mime_type = response.headers['content-type'];
    const extension = mime_type!.split('/')[1];
    const filename = `${slug}.${extension}`;
    await this.storage.set(`${dest}/images/${filename}`, media);
    return `/images/${filename}`;
  }

  async migrate(src: string, dest: string) {
    try{
      new ConsoleMessage().info('Migrating from Ghost to Writr');
      const posts = await this.fetchPosts(src);

      for (const post of posts) {
        const { title, slug, html, feature_image, published_at } = post;

        // Markdown header generation
        const header = this.parser.generateMdHeaders({title, slug, date: published_at});

        let mdContent = `${header}\n\n`;

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
