import { Post } from "../post";
import { Tag } from "../tag";
import { Config } from "../config";
import { DataProviderInterface } from "./dataProviderInterface";
import fs from "fs-extra";
import matter from 'gray-matter';
import {ConsoleMessage} from "../log";

export class FileDataProvider implements DataProviderInterface {
  __postPath: string = "";
  __posts: Array<Post> = [];
  log: any;

  constructor() {
    this.log = new ConsoleMessage()
  }

  init(config: Config) {
    if (config.path) {
      this.__postPath = config.path;
    }
  }

  async getPost(id: string): Promise<Post | undefined> {
    let result: Post | undefined;

    let posts = await this.getPosts();

    posts.forEach(post => {
      if (post.id == this.formatToKey(id)) {
        result = post;
      }
    });

    return result;
  }

  async getPosts(): Promise<Array<Post>> {
    let result: Post[];

    const supportedExtensions = ['.md', '.markdown'];

    const hasExtension = (file: string, extensions: string[]) => {
      return extensions.some(extension => file.toLowerCase().endsWith(extension));
    };

    if (this.__posts.length === 0) {
      let directory = this.__postPath;

      if (fs.existsSync(directory)) {
        let files = fs.readdirSync(directory);

        for (const file of files) {
          if (hasExtension(file, supportedExtensions)) {
            let filePath = directory + "/" + file;
            let post = await this.parsePost(filePath);
            if(post) this.__posts.push(post);
          }
        }

      }
    }

    result = this.__posts;

    return result;
  }

  async getPublishedPosts(): Promise<Array<Post>> {
    let result = new Array<Post>();

    let posts = await this.getPosts();

    posts.forEach((post) => {
      if(post.published) {
        result.push(post);
      }
    });

    return result;
  }

  async getTag(name: string): Promise<Tag | undefined> {
    let result;

    let tags = await this.getTags();

    for (let i = 0; i < tags.length; i++) {
      let tag = tags[i];

      if (this.formatToKey(tag.name) == this.formatToKey(name)) {
        result = tag;
      }
    }

    return result;
  }

  async getTags(): Promise<Array<Tag>> {
    let posts = await this.getPosts();

    return this.generateTags(posts);
  }

  async getPublishedTags(): Promise<Array<Tag>> {
    let posts = await this.getPublishedPosts();

    return this.generateTags(posts);
  }

  generateTags(posts: Array<Post>): Array<Tag> {
    let result = new Array<Tag>();

    posts.forEach(post => {
      post.tags.forEach(tagName => {
        let tag = result.find(t => t.id === new Tag(tagName).id);

        if (tag == null) {
          tag = new Tag(tagName);
          result.push(tag);
        }

        let postExists = tag.posts.find(p => this.formatToKey(p.title) === this.formatToKey(post.title)) != null;

        if (!postExists) {
          tag.posts.push(post);
        }
      });
    });

    return result;
  }

  formatToKey(key: string): string {
    return key.toLowerCase().trim();
  }

  async parsePost(filePath: string): Promise<Post | undefined> {
    let result: Post | undefined;

    if (await fs.pathExists(filePath)) {

      result = new Post();

      let buff = await fs.readFile(filePath);

      let data = buff.toString();

      let m = matter(data);

      let mData: any = m.data;

      result.matter = m.data;

      result.content = m.content;

      //handle categories to tags
      if(mData.categories) {
        if( typeof mData.categories === 'string' ) {
          result.addTags(mData.categories.toString().split(","));
        } else {
          result.addTags(mData.categories);
        }
      }


      if (mData.keywords) {
        result.keywords = mData.keywords.toString().split(",");
      }

      if (mData.tags) {
        result.addTags(mData.tags.toString().split(","));
      }
    } else {
      this.log.error("The following post does not exist: " + filePath);
      result = undefined;
    }

    return result;
  }
}
