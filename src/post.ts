export class Post {
  __title: string = "";
  author: string = "";
  url: string = "";
  createdAt: Date = new Date();
  keywords: Array<string> = [];
  tags: Array<string> = [];
  content: string = "";
  body: string = "";
  header: string = "";
  metaData: { [key: string]: any } = {};

  constructor() { }

  get id(): string {
    if(!this.url) {
      this.generateUrl();
    }
    return this.url;
  }

  set title(val: string) {

    this.__title = val;

    this.generateUrl();
  }

  get title(): string {
    return this.__title;
  }

  generateUrl() {
    if(!this.url) {
      this.url = this.__title.toLowerCase().replace(/[^a-z0-9+]+/gi, " ").trim();
      this.url = this.url.split(" ").join("-");
    }
  }

  static create(obj: any): Post {
    let result = Object.assign(new Post(), obj);

    result.createdAt = new Date(obj.createdAt);

    return result;
  }
}
