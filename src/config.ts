export class Config {
  data: any = {
    type: "file",
    contentPath: "./blog/content",
    postPath: "./blog",
    templatePath: "./blog/template"
  };
  cache = {
    type: "memory",
    connection: "",
    ttl: 60000
  };
}
