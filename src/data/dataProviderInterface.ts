import { Config } from "../config";
import { Post } from "../post";
import { Tag } from "../tag";

export interface DataProviderInterface {
  getPost(id: string): Promise<Post | undefined>;
  getPosts(): Promise<Array<Post>>;
  getTag(name: string): Promise<Tag | undefined>;
  getTags(): Promise<Array<Tag>>;
  init(config: Config): void;
}
