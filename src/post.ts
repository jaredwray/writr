import * as MarkDownIt from "markdown-it";

export class Post {
  keywords: Array<string> = [];
  tags: Array<string> = [];
  content: string = "";
  metaData: { [key: string]: any } = {};

  constructor() { }

  get id(): string {
    return this.url;
  }

  get date(): Date {
    let moment = require("moment");
    let newDate = moment(this.metaData.date).toDate();
    return newDate;
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

  get matter() {
    return this.metaData;
  }

  get body() {

    if(!this.metaData.body) {
      this.metaData.body = new MarkDownIt({html: true}).render(this.content);
    }

    return this.metaData.body;
  }

  get published() {

    if(this.metaData.published === undefined) {
      this.metaData.published = true;
    }
    return this.metaData.published;
  }

  set published(val: boolean) {
    this.metaData.published = val;
  }

  get summary() {

    if(this.metaData.description) {
      this.metaData.summary = this.metaData.description;
    }

    if(!this.metaData.summary) {
      let body = this.body;
      let cheerio = require("cheerio");
      let html = cheerio.load(body);

      let summaryLength = 3;

      this.metaData.summary = "";

      html("p").each((i: number, elem: any) => {

        if(i < summaryLength) {
          this.metaData.summary = this.metaData.summary + html.html(elem);
        }
        
      });
    }

    return this.metaData.summary;
  }

  addTag(name: string) {
    let exists = false;

    if(name) {
      this.tags.forEach((tag) => {
        if(tag === name) {
          exists = true;
        }
      });

      if(!exists) {
        this.tags.push(name);
      }
    }
  }

  addTags(names: Array<string>) {
    names.forEach((name) =>{
      this.addTag(name);
    });
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

  toObject(): any {
    let result: any = {};
    result.keywords = this.keywords;
    result.tags = this.tags;
    result.content = this.content;
    result.id = this.id;
    result.date = this.date;
    result.title = this.title;
    result.author = this.author;
    result.url = this.url;
    result.body = this.body;
    result.summary = this.summary;
    result.metaData = this.metaData;
    result.matter = this.metaData;
    result.published = this.published;
    
    return result;
  }

  static create(obj: any): Post {
    let result = Object.assign(new Post(), obj);

    return result;
  }
}
