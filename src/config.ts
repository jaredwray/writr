import * as fs from "fs-extra";
import { Logger, transports } from "winston";

export class Config {
  data: ConfigData = new ConfigData();
  cache: ConfigCache = new ConfigCache();
  log = new Logger({ transports: [new transports.Console()] });

  constructor(config: any = undefined) {
    if (config) {
      this.parse(config);
    }
  }

  load(filePath: string) : Boolean {
    let result: Boolean = false;

    if(fs.existsSync(filePath)) {
      let buff = fs.readFileSync(filePath);

      let obj = JSON.parse(buff.toString());

      console.log(obj);

      this.parse(obj);

      result = true;

    } else {
      this.log.info("the config file does not exist: " + filePath);
    }

    return result;
  }

  parse(obj: any) {
    if (obj) {
      if (obj.data) {
        if (obj.data.type) {
          this.data.type = obj.data.type;
        }
        if (obj.data.contentPath) {
          this.data.contentPath = obj.data.contentPath;
        }
        if (obj.data.postPath) {
          this.data.postPath = obj.data.postPath;
        }
        if (obj.data.templatePath) {
          this.data.templatePath = obj.data.templatePath;
        }
      }
      if (obj.cache) {
        if (obj.cache.connection) {
          this.cache.connection = obj.cache.connection;
        }
        if (obj.cache.ttl) {
          this.cache.ttl = obj.cache.ttl;
        }
        if (obj.cache.type) {
          this.cache.type = obj.cache.type;
        }
      }
    }
  }
}

export class ConfigData {
  constructor() {}

  type: string = "file";
  contentPath: string = "./blog/images";
  postPath: string = "./blog";
  templatePath: string = "./blog/template";
}

export class ConfigCache {
  constructor() {}

  connection: string = "";
  ttl: number = 6000;
  type: string = "memory";
}
