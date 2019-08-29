import * as MarkDownIt from "markdown-it";

export class Post {
  createdDate: Date = new Date();
  keywords: Array<string> = [];
  tags: Array<string> = [];
  content: string = "";
  metaData: { [key: string]: any } = {};

  constructor() { }

  get id(): string {
    if(!this.url) {
      this.generateUrl();
    }
    return this.url;
  }

  get title(): string {
    return this.metaData.title;
  }
  set title(val: string) {

    this.metaData.title = val;

    this.generateUrl();
  }

  get author(): string {
    return this.metaData.author;
  }

  set author(val: string) {
    this.metaData.author = val;
  }

  get url() {
    if(!this.metaData.url) {
      this.generateUrl();
    } 
    return this.metaData.url;
  }

  set url(val: string) {
    this.metaData.url = val;
  }

  get date(): Date {
    return this.createdDate;
  }
  set date(val: Date) {
    this.createdDate = val;
  }

  get body() {

    if(!this.metaData.body) {
      this.metaData.body = new MarkDownIt().render(this.content);
    }

    return this.metaData.body;
  }

  generateUrl() {

    if(!this.metaData.url) {
      if(this.metaData.permalink) {
        this.metaData.url = this.metaData.permalink;
      } else if(this.metaData.slug) {
        this.metaData.url = this.metaData.slug;
      }

      if(!this.metaData.url) {
        let url = this.metaData.title.toLowerCase().replace(/[^a-z0-9+]+/gi, " ").trim();
        url = url.split(" ").join("-");
        this.metaData.url = url;
      }
    }
  }

  static create(obj: any): Post {
    let result = Object.assign(new Post(), obj);

    result.createdAt = new Date(obj.createdAt);

    return result;
  }
}
