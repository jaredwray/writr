import { Config } from "../config";
import { Post } from "../post";
import { Tag } from "../tag";
import Keyv = require("keyv");

export class DataCacheService {
  cache: Keyv;

  constructor(config: Config) {

    config = new Config();

    this.cache = new Keyv({ ttl: config.cache.ttl, namespace: "data-cache" });
  }

  //cache
  async getPost(key: string): Promise<Post | undefined> {
    key = this.formatName(key, "post");

    let result = await this.cache.get(key);

    if (result) {
      result = Post.create(result);
    }

    return result;
  }

  async setPost(key: string, post: Post): Promise<boolean | undefined> {
    return await this.cache.set(this.formatName(key, "post"), post);
  }

  async getPosts(key: string): Promise<Array<Post> | undefined> {
    key = this.formatName(key, "post");

    let result = await this.cache.get(key);

    if (result) {
      let posts = new Array<Post>();

      for (let i = 0; i < result.length; i++) {
        posts.push(Post.create(result[i]));
      }

      result = posts;
    }

    return result;
  }

  async setPosts(key: string, posts: Array<Post>): Promise<boolean | undefined> {
    return await this.cache.set(this.formatName(key, "post"), posts);
  }

  async getTag(key: string): Promise<Tag | undefined> {
    key = this.formatName(key, "tag");

    let result = await this.cache.get(key);

    if (result) {
      result = Tag.create(result);
    }

    return result;
  }

  async setTag(key: string, tag: Tag): Promise<boolean | undefined> {
    return await this.cache.set(this.formatName(key, "tag"), tag);
  }

  async getTags(key: string): Promise<Array<Tag> | undefined> {
    key = this.formatName(key, "tag");

    let result = await this.cache.get(key);

    if (result) {
      let tags = new Array<Tag>();

      for (let i = 0; i < result.length; i++) {
        tags.push(Tag.create(result[i]));
      }

      result = tags;
    }

    return result;
  }

  async setTags(key: string, tags: Array<Tag>): Promise<boolean | undefined> {
    return await this.cache.set(this.formatName(key, "tag"), tags);
  }

  async clear(): Promise<void> {
    await this.cache.clear();
  }

  formatName(name: string, type: string): string {
    let result =  type.trim() + "-" + name.trim();
    result = result.toLowerCase();

    return result;
  }
}
