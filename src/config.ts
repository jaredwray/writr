import * as fs from "fs-extra";
import { Logger, transports } from "winston";

export class Config {
  cache: ConfigCache = new ConfigCache();
  log = new Logger({ transports: [new transports.Console()] });
  program: any = {};
  provider: any = {};
  render: Array<string> = ["html", "json", "atom"];
  output: string = "./blog_output";
  path: string = "./blog";
  title: string = "";
  url: string = "";
  authorName: string = "";
  authorEmail: string = "";
  indexCount: number = 20;

  constructor(config: any = undefined) {
    
    //set default for fileProvider
    this.provider.name = "file";
    
    if (config) {
      this.parse(config);
    }
  }

  loadPath(path: string) : boolean {
    this.path = path;
    return this.loadConfig(this.path + "/config.json");
  }

  loadConfig(filePath: string): boolean {
    let result: boolean = false;

    if (fs.existsSync(filePath)) {
      let buff = fs.readFileSync(filePath);

      let obj = JSON.parse(buff.toString());

      this.parse(obj);

      result = true;

    } else {
      this.log.info("the config file does not exist: " + filePath);
    }

    return result;
  }

  loadProgram(program: any) {
    this.program = program;

    this.parse(this.program);
  }

  parse(obj: any) {
    if (obj) {

      if(obj.render) {
        if(typeof obj.render === "string") {
          this.render = obj.render.split(",");
        } else {
          this.render = obj.render;
        }
      }

      if(obj.output) {
        this.output = obj.output;
      }

      if(obj.path) {
        this.path = obj.path;
      }

      if(obj.title) {
        this.title = obj.title;
      }

      if(obj.url) {
        this.url = obj.url;
      }

      if(obj.authorName) {
        this.authorName = obj.authorName;
      }

      if(obj.authorEmail) {
        this.authorEmail = obj.authorEmail;
      }

      if(obj.indexCount) {
        this.indexCount = obj.indexCount;
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

export class ConfigCache {
  constructor() { }

  connection: string = "";
  ttl: number = 6000;
  type: string = "memory";
}
