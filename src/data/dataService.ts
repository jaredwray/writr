import { Config } from "../config";
import { Post } from "../post";
import { Tag } from "../tag";
import { DataProviderInterface } from "./dataProviderInterface";
import { FileDataProvider } from "./fileDataProvider";
import { DataCacheService } from "./dataCacheService";

export class DataService {
  config: Config;
  cache: DataCacheService;

  constructor(config: Config) {
    this.config = config;
    this.cache = new DataCacheService(this.config);
  }

  //posts
  async getPost(id: string): Promise<Post | undefined> {
    let result = undefined;

    result = await this.cache.getPost(id);

    if (!result) {
      result = await this.getProvider().getPost(id);

      if (result) {
        await this.cache.setPost(id, result);
      }
    }

    return result;
  }

  async getPublishedPost(id: string): Promise<Post | undefined> {
    let result = undefined;

    result = await this.cache.getPost(id);

    if (!result) {
      result = await this.getProvider().getPublishedPost(id);

      if (result) {
        await this.cache.setPost(id, result);
      }
    }

    if (result) {
      if (!result.isPublished()) {
        result = undefined;
      }
    }

    return result;
  }

  async getPosts(): Promise<Array<Post>> {
    let result = new Array<Post>();

    let cacheKey = "get-posts";
    let posts = await this.cache.getPosts(cacheKey);

    if (!posts) {
      result = await this.getProvider().getPosts();

      if (result) {
        await this.cache.setPosts(cacheKey, result);
      }
    } else {
      result = posts;
    }

    return result;
  }

  async getPublishedPosts(): Promise<Array<Post>> {
    let result = new Array<Post>();

    let cacheKey = "get-published-posts";
    let posts = await this.cache.getPosts(cacheKey);

    if (!posts) {
      result = await this.getProvider().getPublishedPosts();

      if (result) {
        await this.cache.setPosts(cacheKey, result);
      }
    } else {
      result = posts;
    }

    return result;
  }

  //tags
  async getTag(name: string): Promise<Tag | undefined> {
    let result = undefined;

    result = await this.cache.getTag(name);

    if (!result) {
      result = await this.getProvider().getTag(name);

      if (result) {
        await this.cache.setTag(name, result);
      }
    }

    return result;
  }

  async getPublishedTag(name: string): Promise<Tag | undefined> {
    let result = undefined;

    result = await this.cache.getTag(name);

    if (!result) {
      result = await this.getProvider().getPublishedTag(name);

      if (result) {
        await this.cache.setTag(name, result);
      }
    }

    if (result) {
      if (!result.isPublished()) {
        result = undefined;
      }
    }

    return result;
  }

  async getTags(): Promise<Array<Tag>> {
    let result = new Array<Tag>();

    let cacheKey = "get-tags";

    let tags = await this.cache.getTags(cacheKey);

    if (!tags) {
      result = await this.getProvider().getTags();

      if (result) {
        await this.cache.setTags(cacheKey, result);
      }
    } else {
      result = tags;
    }

    return result;
  }

  async getPublishedTags(): Promise<Array<Tag>> {
    let result = new Array<Tag>();

    let cacheKey = "get-published-tags";

    let tags = await this.cache.getTags(cacheKey);

    if (!tags) {
      result = await this.getProvider().getPublishedTags();

      if (result) {
        await this.cache.setTags(cacheKey, result);
      }
    } else {
      result = tags;
    }

    return result;
  }

  getProvider(): DataProviderInterface {
    let result = undefined;

    switch (this.config.data.type) {
      default:
        result = new FileDataProvider();
        break;
    }

    result.init(this.config.data);

    return result;
  }
}
