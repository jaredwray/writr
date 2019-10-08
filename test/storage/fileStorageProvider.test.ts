import { expect } from "chai";
import { Config } from "../../src/config";
import { FileStorageProvider } from "../../src/storage/fileStorageProvider";
import "mocha";

describe("File Storage Provider", () => {
  let config: Config = new Config();
  let fileStorageProvider: FileStorageProvider = new FileStorageProvider();
  let filePath;

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
    filePath = config.path +"/article1.md";
    this.fileStorageProvider = new FileStorageProvider();

  });

  it("get file should show undefined", async () => {
    
    let fileData = await fileStorageProvider.get("");

    expect(fileData).to.equal(undefined);
  });

  it("set file should show false on no data", async () => {
    let path = config.path + "/foo.md";

    let result = await fileStorageProvider.set(path, undefined);

    expect(result).to.equal(false);
  });

  it("set file should show false on no path", async () => {
    let data = "boo hoo";

    let result = await fileStorageProvider.set(undefined, data);

    expect(result).to.equal(false);
  });

  it("exist file should show false on bad path", async () => {
    let path = config.path + "/foo.md";

    let result = await fileStorageProvider.exists(path);

    expect(result).to.equal(false);
  });

  it("delete file should show false on bad path", async () => {
    let path = config.path + "/foo.md";

    let result = await fileStorageProvider.delete(path);

    expect(result).to.equal(false);
  });

});