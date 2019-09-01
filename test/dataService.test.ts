import { expect } from "chai";
import "mocha";

import { Config } from "../src/config";
import { DataService } from "../src/data/dataService";

describe("Data Service", async () => {
  let config: Config = new Config();
  let ds: DataService;

  before(async () => {
    config.data.type = "file";
    config.data.postPath = __dirname + "/blog";
    config.data.contentPath = __dirname + "/blog/content";
    config.data.templatePath = __dirname + "/blog/templates";
    ds = new DataService(config);
  });

  it("get a provider based on the config", () => {
    expect(ds.getProvider()).to.not.equal(undefined);
  });

  it("get posts", async () => {
    let posts = await ds.getPosts();

    expect(posts.length).to.equal(5);
  });

  it("get posts from cache", async () => {
    await ds.getPosts();

    let posts2 = await ds.getPosts();

    expect(posts2.length).to.equal(5);
  });

  it("get posts with a miss", async () => {

    let config2 = new Config();
    let ds2 = new DataService(config2);

    let posts = await ds2.getPosts();

    expect(posts.length).to.equal(0);
  });

  it("get post", async () => {
    let post = await ds.getPost("article-simple");

    expect(post.title).to.equal("Article Simple");
  });

  it("get post with a miss", async () => {
    let post = await ds.getPost("sdfsfsdfsddfsd");

    expect(post).to.equal(undefined);
  });


  it("get tags", async () => {
    let tags = await ds.getTags();

    expect(tags.length).to.equal(12);
  });

  it("get tags from cache", async () => {
    await ds.getTags();

    let tags = await ds.getTags();

    expect(tags.length).to.equal(12);
  });

  it("get tag with a miss", async () => {
    let tag = await ds.getTag("sdfkjslfkjse");

    expect(tag).to.equal(undefined);
  });

  it("get tag", async () => {
    let tag = await ds.getTag("tesla");

    expect(tag.id).to.equal("tesla");
  });

  it("get tag from cache", async () => {
    await ds.getTag("tesla");
    let tag = await ds.getTag("tesla");

    expect(tag.id).to.equal("tesla");
  });

});
