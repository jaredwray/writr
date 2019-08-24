import { Config } from "./config";
import { DataService } from "./data/dataService";
import { Logger, transports } from "winston";
import * as handlebars from "handlebars";
import * as fs from "fs";
import * as writrExpress from "../express/index";

const log = new Logger({ transports: [new transports.Console()] });
let __config: Config;
let __dataStore: DataService;

export function init(config: Config = new Config()): void {
  __config = config;

  __dataStore = new DataService(__config);
}

export function express() {
  return writrExpress;
}

export function dataStore() {
  return __dataStore;
}

//render
export async function renderHome(): Promise<string> {
  let result = "";

  let postList = await __dataStore.getPublishedPosts();
  let tagList = await __dataStore.getPublishedTags();

  let source: string = getHomeTemplate();
  result = render(source, { tags: tagList, posts: postList });

  return result;
}

export async function renderTag(tagName: string): Promise<string> {
  let result = "";

  let tag = await __dataStore.getPublishedTag(tagName.toLowerCase().trim());

  if (tag) {
    let source: string = getTagTemplate();
    result = render(source, tag);
  }

  return result;
}

export async function renderPost(postID: string, previewKey?: string): Promise<string> {
  let result = "";
  let post = await __dataStore.getPost(postID);

  if (post) {
    if (!post.isPublished()) {
      if (previewKey) {
        if (post.previewKey != previewKey) {
          post = undefined;
        }
      } else {
        post = undefined;
      }
    }
  }

  if (post) {
    let source: string = getPostTemplate();
    result = render(source, post);
  }

  return result;
}

export function render(source: string, data: object): string {
  let result = "";

  let template: handlebars.Template = handlebars.compile(source);
  result = template(data);

  return result;
}

//Templates
export function getPostTemplate(): string {
  let result = "";

  result = fs.readFileSync(__config.data.templatePath + "/post.hjs").toString();

  return result;
}

export function getTagTemplate(): string {
  let result = "";

  result = fs.readFileSync(__config.data.templatePath + "/tag.hjs").toString();

  return result;
}

export function getHomeTemplate(): string {
  let result = "";

  result = fs.readFileSync(__config.data.templatePath + "/index.hjs").toString();

  return result;
}

//Config
export function getConfig(): Config {
  return __config;
}
