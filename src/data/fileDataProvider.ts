import { Post } from "../post";
import { Tag } from "../tag";
import { DataProviderInterface } from "./dataProviderInterface";
import * as fs from "fs-extra";
import * as MarkDownIt from "markdown-it";
import { Logger, transports } from "winston";
import * as matter from 'gray-matter';

export class FileDataProvider implements DataProviderInterface {
  __postPath: string = "";
  __posts: Array<Post> = [];
  __log: any;

  constructor() {
    this.__log = new Logger({ transports: [new transports.Console()] });
  }

  init(config: any) {
    if (config.postPath) {
      this.__postPath = config.postPath;
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
            this.__posts.push(post);
          }
        }
      }
    }

    result = this.__posts;

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

  generateTags(posts: Array<Post>): Array<Tag> {
    let result = new Array<Tag>();

    posts.forEach(post => {
      post.tags.forEach(tagName => {
        let tag = result.find(t => this.formatToKey(t.name) === this.formatToKey(tagName));

        if (tag == null) {
          tag = new Tag(this.formatToKey(tagName));
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

  async parsePost(filePath: string): Promise<Post> {
    let result: Post = new Post();

    try {
      if (fs.existsSync(filePath)) {
        let buff = await fs.readFile(filePath);

        let data = buff.toString();

        let m;

        if (data.indexOf("}}}") > 0) {
          m = matter(data, { delimiters: ["{{{", "}}}"] });
        } else {
          m = matter(data);
        }

        let mData: any = m.data;

        result.header = "";

        result.content = m.content;

        //clean up header
        result.header = result.header.replace("\n", "");

        if (mData.title) {
          result.title = mData.title;
        }

        if (mData.author) {
          result.author = mData.author;
        }

        if (mData.url) {
          result.url = mData.url;
        }

        if (mData.createdAt) {
          result.createdAt = new Date(mData.createdAt);
        }

        if (mData.keywords) {
          result.keywords = mData.keywords.toString().split(",");
        }

        if (mData.tags) {
          result.tags = mData.tags.toString().split(",");
        }

        if (mData.previewKey) {
          result.previewKey = mData.previewKey;
        }

        //generate html from markdown
        let markdown = new MarkDownIt();
        result.body = markdown.render(result.content);
      } else {
        this.__log.error("The following post does not exist: " + filePath);
      }
    } catch (error) {
      this.__log.error(error);
      throw new Error(error);
    }

    return result;
  }
}
