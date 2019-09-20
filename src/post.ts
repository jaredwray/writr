import * as MarkDownIt from "markdown-it";

export class Post {
  keywords: Array<string> = [];
  tags: Array<string> = [];
  content: string = "";
  private _matter: { [key: string]: any } = {};

  constructor() { }

  get id(): string {
    return this.url;
  }

  get date(): Date {
    let moment = require("moment");
    let newDate = moment(this.matter.date).toDate();
    return newDate;
  }

  get title(): string {
    return this.matter.title;
  }
  set title(val: string) {

    this.matter.title = val;

    this.generateUrl();
  }

  get author(): string {
    return this.matter.author;
  }

  set author(val: string) {
    this.matter.author = val;
  }

  get url() {
    if(!this.matter.url) {
      this.generateUrl();
    } 
    return this.matter.url;
  }

  set url(val: string) {
    this.matter.url = val;
  }

  get matter() {
    return this._matter;
  }

  set matter(val: any) {
    this._matter = val;
  }

  get metaData() {
    return this._matter;
  }

  set metaData(val: { [key: string]: any }) {
    this._matter = val;
  }

  get body() {

    if(!this.matter.body) {
      this.matter.body = new MarkDownIt({html: true}).render(this.content);
    }

    return this.matter.body;
  }

  get published() {

    if(this.matter.published === undefined) {
      this.matter.published = true;
    }
    return this.matter.published;
  }

  set published(val: boolean) {
    this.matter.published = val;
  }

  get summary() {

    if(this.matter.description) {
      this.matter.summary = this.matter.description;
    }

    if(!this.matter.summary) {
      let body = this.body;
      let cheerio = require("cheerio");
      let html = cheerio.load(body);

      let summaryLength = 3;

      this.matter.summary = "";

      html("p").each((i: number, elem: any) => {

        if(i < summaryLength) {
          this.matter.summary = this.matter.summary + html.html(elem);
        }
        
      });
    }

    return this.matter.summary;
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
      if(name){
        this.addTag(name);
      }
    });
  }

  generateUrl() {

    if(!this.matter.url) {
      if(this.matter.permalink) {
        this.matter.url = this.matter.permalink;
      } else if(this.matter.slug) {
        this.matter.url = this.matter.slug;
      }

      if(!this.matter.url) {
        let url = this.matter.title.toLowerCase().replace(/[^a-z0-9+]+/gi, " ").trim();
        url = url.split(" ").join("-");
        this.matter.url = url;
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
    result.metaData = this._matter;
    result.matter = this._matter;
    result.published = this.published;
    
    return result;
  }

  static create(obj: any): Post {
    let result = Object.assign(new Post(), obj);

    return result;
  }
}
