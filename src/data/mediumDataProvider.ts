import { Config } from "../config";
import { Post } from "../post";
import { Tag } from "../tag";
import { DataProviderInterface } from "./dataProviderInterface";
import { Logger, transports } from "winston";

export class MediumDataProvider implements DataProviderInterface {
  __config: Config = new Config();
  __posts: Array<Post> = new Array<Post>();
  __log: any;

  constructor() {
    this.__log = new Logger({ transports: [new transports.Console()] });
  }
  
  async getPost(id: string): Promise<Post | undefined> {
    let result: Post | undefined;

    return result;
  }

  async getPublishedPost(id: string): Promise<Post | undefined> {
    let result: Post | undefined;

    return result;
  }

  async getPosts(): Promise<Array<Post>> {
    let result = new Array<Post>();

    return result;
  }

  async getPublishedPosts(): Promise<Array<Post>> {
    let result = new Array<Post>();

    return result;
  }

  async getTag(name: string): Promise<Tag | undefined> {
    let result;

    return result;
  }

  async getPublishedTag(name: string): Promise<Tag | undefined> {
    let result;

    return result;
  }

  async getTags(): Promise<Array<Tag>> {
    let result = new Array<Tag>();

    return result;
  }

  async getPublishedTags(): Promise<Array<Tag>> {
    let result = new Array<Tag>();

    return result;
  }

  init(config: Config): void {
    this.__config = config;
  }
}
