import { Config } from "../config.js";
import { Post } from "../post.js";
import { Tag } from "../tag.js";

export interface DataProviderInterface {
  getPost(id: string): Promise<Post | undefined>;
  getPosts(): Promise<Array<Post>>;
  getPublishedPosts(): Promise<Array<Post>>;
  getTag(name: string): Promise<Tag | undefined>;
  getTags(): Promise<Array<Tag>>;
  getPublishedTags(): Promise<Array<Tag>>;
  init(config: Config): void;
}
