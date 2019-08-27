import { expect } from "chai";
import { Config, ConfigData } from "../src/config";
import { FileDataProvider } from "../src/data/fileDataProvider";
import "mocha";

describe("fileDataProvider", () => {
  let config: Config = new Config();

  before(() => {
    config.data = new ConfigData();
    config.data.type = "file";
    config.data.postPath = __dirname + "/blog";
    config.data.contentPath = __dirname + "/blog/content";
    config.data.templatePath = __dirname + "/blog/templates";
  });

  it("config gets setup in init", () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    expect(fileProvider.__postPath).to.equal(config.data.postPath);
  });

  it("should get the posts from the file system", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let posts = await fileProvider.getPosts();

    expect(posts.length).to.equal(4);
  });

  it("should get a valid post", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let post = await fileProvider.getPost("article-simple");

    expect(post.title).to.equal("Article Simple");
  });

  it("should not get a valid post", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let post = await fileProvider.getPost("article");

    expect(post).to.equal(undefined);
  });

  it("should get a valid published post", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let post = await fileProvider.getPublishedPost(
      "all-about-the-tesla-model-3"
    );

    expect(post.title).to.equal("Tesla Model 3");
  });

  it("should not get a valid published post", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let post = await fileProvider.getPublishedPost("the-largest-whale");

    expect(post).to.equal(undefined);
  });

  it("should published posts", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let posts = await fileProvider.getPublishedPosts();

    expect(posts.length).to.equal(3);
  });

  it("should have a valid tag", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let tag = await fileProvider.getTag("whale");

    expect(tag.name).to.equal("whale");
  });

  it("should have a valid tag and multiple posts", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let tag = await fileProvider.getTag("whale");

    expect(tag.posts.length).to.equal(2);
  });

  it("should have a invalid tag", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let tag = await fileProvider.getTag("snoopy");

    expect(tag).to.equal(undefined);
  });

  it("should have a valid tag and is published", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let tag = await fileProvider.getTag("whale");

    expect(tag.isPublished()).to.equal(true);
  });

  it("should have a tag that is not publshed", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let tag = await fileProvider.getPublishedTag("large");

    expect(tag).to.equal(undefined);
  });

  it("should have a all tags that are published", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let tags = await fileProvider.getPublishedTags();

    expect(tags.length).to.equal(6);
  });

  it("should generate the correct amount of tags", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config.data);

    let posts = await fileProvider.getPosts();

    let tags = await fileProvider.generateTags(posts);

    expect(tags.length).to.equal(9);
  });
});
