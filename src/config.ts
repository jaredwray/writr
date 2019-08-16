export class Config {

  data: ConfigData = new ConfigData();
  cache: ConfigCache = new ConfigCache();

  constructor(config: any = undefined) {

    if(config) {
      this.parse(config);
    }
  }

  parse(obj:any) {
    if(obj) {
      if(obj.data) {
        if(obj.data.type) {
          this.data.type = obj.data.type;
        }
        if(obj.data.contentPath) {
          this.data.contentPath = obj.data.contentPath;
        }
        if(obj.data.postPath) {
          this.data.postPath = obj.data.postPath;
        }
        if(obj.data.templatePath) {
          this.data.templatePath = obj.data.templatePath;
        }
      }
      if(obj.cache) {
        if(obj.cache.connection) {
          this.cache.connection = obj.cache.connection;
        }
        if(obj.cache.ttl) {
          this.cache.ttl = obj.cache.ttl;
        }
        if(obj.cache.type) {
          this.cache.type = obj.cache.type;
        }
      }
    }
  }
}

export class ConfigData {

  constructor() {

  }

  type: string = "file";
  contentPath: string = "./blog/images";
  postPath: string = "./blog";
  templatePath: string = "./blog/template"
}

export class ConfigCache {

  constructor() {

  }

  connection: string = "";
  ttl: number = 6000;
  type: string = "memory";
}