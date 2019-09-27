import * as MarkDownIt from "markdown-it";

export class Post {
  keywords: Array<string> = [];
  tags: Array<string> = [];
  content: string = "";
  private _matter: { [key: string]: any } = {};

  permalink_default: string = ":title";
  permalink_date: string = ":year/:month/:day/:title";
  permalink_ordinal: string = ":year/:y_day/:title";

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
      
      //set default
      let url = this.permalink_default;

      //check slug first
      if(this.matter.slug) {
        url = this.matter.slug;
      }

      //check permalink second
      if(this.matter.permalink) {
        url = this.matter.permalink;
      }

      this.matter.url = this.parseUrl(url);
    }
  }

  parseUrl(url:string): string {

    let moment = require("moment");
    let date = moment(this.date);

    //title
    let title = this._matter.title.toLowerCase().replace(/[^a-z0-9+]+/gi, " ").trim();
    title = title.split(" ").join("-");

    //do styles
    if(url.toLowerCase().trim() === "default") {
      url = this.permalink_default;
    }

    if(url.toLowerCase().trim() === "date") {
      url = this.permalink_date;
    }

    if(url.toLowerCase().trim() === "ordinal") {
      url = this.permalink_ordinal;
    }
    
    url = url.split(":year").join(date.format("YYYY"));
    url = url.split(":short_year").join(date.format("YY"));
    url = url.split(":month").join(date.format("MM"));
    url = url.split(":i_month").join(date.format("M"));
    url = url.split(":short_month").join(date.format("MMM"));
    url = url.split(":long_month").join(date.format("MMMM"));
    url = url.split(":day").join(date.format("DD"));
    url = url.split(":i_day").join(date.format("D"));
    url = url.split(":y_day").join(date.format("DDD"));
    url = url.split(":short_day").join(date.format("dd"));
    url = url.split(":long_day").join(date.format("dddd"));
    url = url.split(":week").join(date.format("ww"));
    url = url.split(":hour").join(date.format("HH"));
    url = url.split(":minute").join(date.format("mm"));
    url = url.split(":second").join(date.format("ss"));
    
    url = url.split(":title").join(title);

    //url remove white spaces
    url = url.split(" ").join("-");

    //url remove `/`
    if(url.startsWith("/")) {
      url = url.substring(1);
    }

    return url;
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
