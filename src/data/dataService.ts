import { Config } from "../config";
import { Post } from "../post";
import { Tag } from "../tag";
import { DataProviderInterface } from "./dataProviderInterface";
import { FileDataProvider } from "./fileDataProvider";
import { Cache } from "../cache";
import arraySort from "array-sort";

export class DataService {
  config: Config;
  cache: Cache;

  constructor(config: Config) {
    this.config = config;
    this.cache = new Cache(this.config);
  }

  //posts
  async getPost(id: string): Promise<Post | undefined> {
    let result = await this.cache.getPost(id);

    if (!result) {
      result = await this.getProvider().getPost(id);

      if (result) {
        await this.cache.setPost(id, result);
      }
    }

    return result;
  }

  async getPosts(): Promise<Array<Post>> {
    let result: Post[];

    let cacheKey = "get-posts";
    let posts = await this.cache.getPosts(cacheKey);

    if (!posts) {
      result = await this.getProvider().getPosts();

      //sort
      result = arraySort(result, "date", { reverse: true })
      //cache
      await this.cache.setPosts(cacheKey, result);

    } else {
      result = posts;
    }

    return result;
  }

  async getPublishedPosts(): Promise<Array<Post>> {
    let result: Post[];

    let cacheKey = "get-published-posts";
    let posts = await this.cache.getPosts(cacheKey);

    if (!posts) {
      result = await this.getProvider().getPublishedPosts();

      //sort
      result = arraySort(result, "date", { reverse: true })
      //cache
      await this.cache.setPosts(cacheKey, result);

    } else {
      result = posts;
    }

    return result;
  }

  async getPostsByCount(count: number): Promise<Array<Post>> {
    let result = await this.getPosts();

      let list = new Array<Post>();
      let currentCount = 0;

      result.forEach((post) => {
        if(currentCount < count) {
          list.push(post);
          currentCount++;
        }
      });

      result = list;

      return result;
  }

  async getPublishedPostsByCount(count: number): Promise<Array<Post>> {
    let result = await this.getPublishedPosts();

      let list = new Array<Post>();
      let currentCount = 0;

      result.forEach((post) => {
        if(currentCount < count) {
          list.push(post);
          currentCount++;
        }
      });

      result = list;

      return result;
  }

  //tags
  async getTag(name: string): Promise<Tag | undefined> {
    let result = await this.cache.getTag(name);

    if (!result) {
      result = await this.getProvider().getTag(name);

      if (result) {
        await this.cache.setTag(name, result);
      }
    }

    return result;
  }

  async getTags(): Promise<Array<Tag>> {
    let result: Tag[];

    let cacheKey = "get-tags";

    let tags = await this.cache.getTags(cacheKey);

    if (!tags) {
      result = await this.getProvider().getTags();
      //sort
      result = arraySort(result, "id", { reverse: false })
      await this.cache.setTags(cacheKey, result);

    } else {
      result = tags;
    }

    return result;
  }

  async getPublishedTags(): Promise<Array<Tag>> {
    let result: Tag[];

    let cacheKey = "get-published-tags";

    let tags = await this.cache.getTags(cacheKey);

    if (!tags) {
      result = await this.getProvider().getPublishedTags();
      //sort
      result = arraySort(result, "id", { reverse: false });

      await this.cache.setTags(cacheKey, result);

    } else {
      result = tags;
    }

    return result;
  }

  getProvider(): DataProviderInterface {
    let result;

    switch (this.config.provider.name) {
      default:
        result = new FileDataProvider();
        break;
    }

    result.init(this.config);

    return result;
  }
}
