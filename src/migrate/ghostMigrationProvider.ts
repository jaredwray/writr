import {createLogger, transports} from "winston";
import fetch from "node-fetch";
import {MigrationProviderInterface} from "./migrationProviderInterface";
import {Parser} from "../utils/parser";
import {StorageService} from "../storage/storageService";


export class GhostMigrationProvider implements MigrationProviderInterface {

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
      const url = new URL(src);
      const { searchParams, origin } = url;
      const key = searchParams.get('key');

      let totalPosts: Record<string, any>[];

      const initialData = await fetch(`${origin}/ghost/api/v2/content/posts/?key=${key}`);
      const { posts, meta } = await initialData.json();
      totalPosts = [...posts];

      const { pagination: { pages } } = meta;

      for(let i = 2; i <= pages; i++) {
        const data = await fetch(`${origin}/ghost/api/v2/content/posts/?key=${key}&page=${i}`);
        const { posts } = await data.json();
        totalPosts = totalPosts.concat(posts);
      }

      return totalPosts;

    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async saveMedia(mediaFetched: any, dest: string) {
    const { mediaUrl, slug } = mediaFetched;
    const response = await fetch(mediaUrl);
    const media = await response.buffer();
    const mime_type = response.headers.get('content-type');
    const extension = mime_type!.split('/')[1];
    const filename = `${slug}.${extension}`;
    await this.storage.set(`${dest}/images/${filename}`, media);
    return `/images/${filename}`;
  }

  async migrate(src: string, dest: string) {
    try{
      this.log.info('Migrating from Ghost to Writr');
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
      this.log.info("Migration was completed successfully");
      return true;
    } catch (error: any) {
      throw new Error('Error while migrating Ghost site: ' + src)
    }
  }

}
