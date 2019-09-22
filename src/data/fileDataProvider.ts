import { Post } from "../post";
import { Tag } from "../tag";
import { Config } from "../config";
import { DataProviderInterface } from "./dataProviderInterface";
import * as fs from "fs-extra";
import { Logger, transports } from "winston";
import * as matter from 'gray-matter';

export class FileDataProvider implements DataProviderInterface {
  __postPath: string = "";
  __posts: Array<Post> = [];
  log: any;

  constructor() {
    this.log = new Logger({ transports: [new transports.Console()] });
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
    let result = new Array<Post>();

    if (this.__posts.length == 0) {
      let directory = this.__postPath;
      
      if (await fs.existsSync(directory)) {
        let files = await fs.readdirSync(directory);

        for (let i = 0; i < files.length; i++) {
          let file = files[i];

          if (file.indexOf(".md") > 0) {
            let filePath = directory + "/" + file;
            let post = await this.parsePost(filePath);
            if(post) {
            this.__posts.push(post);
            }
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
    let result: Post | undefined = new Post();

    if (await fs.pathExists(filePath)) {
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
