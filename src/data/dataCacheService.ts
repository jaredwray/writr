import { Config } from "../config";
import { Post } from "../post";
import { Tag } from "../tag";
import Keyv = require("keyv");

export class DataCacheService {
  private __postCache: Keyv;
  private __tagCache: Keyv;

  constructor(config: Config) {

    config = new Config();

    this.__postCache = new Keyv({ ttl: config.cache.ttl, namespace: "data-post" });
    this.__tagCache = new Keyv({ ttl: config.cache.ttl, namespace: "data-tag" });
  }

  //cache
  async getPost(key: string): Promise<Post | undefined> {
    key = this.formatName(key);

    let result = await this.__postCache.get(key);

    if (result) {
      result = Post.create(result);
    }

    return result;
  }

  async setPost(key: string, post: Post): Promise<boolean | undefined> {
    return await this.__postCache.set(this.formatName(key), post);
  }

  async getPosts(key: string): Promise<Array<Post> | undefined> {
    key = this.formatName(key);

    let result = await this.__postCache.get(key);

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
    return await this.__postCache.set(this.formatName(key), posts);
  }

  async getTag(key: string): Promise<Tag | undefined> {
    key = this.formatName(key);

    let result = await this.__tagCache.get(key);

    if (result) {
      result = Tag.create(result);
    }

    return result;
  }

  async setTag(key: string, tag: Tag): Promise<boolean | undefined> {
    return await this.__tagCache.set(this.formatName(key), tag);
  }

  async getTags(key: string): Promise<Array<Tag> | undefined> {
    key = this.formatName(key);

    let result = await this.__tagCache.get(key);

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
    return await this.__tagCache.set(this.formatName(key), tags);
  }

  async clear(): Promise<void> {
    await this.__postCache.clear();
    await this.__tagCache.clear();
  }

  formatName(name: string): string {
    return name.toLowerCase().trim();
  }
}
