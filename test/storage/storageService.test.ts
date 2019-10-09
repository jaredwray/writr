import { expect } from "chai";
import { Config } from "../../src/config";
import { StorageService } from "../../src/storage/storageService";
import { Logger, transports } from "winston";
import * as fs from "fs-extra";
import "mocha";
import { after } from "mocha";

describe("Storage Service", () => {
  let config: Config = new Config();
  let storage: StorageService = new StorageService(config);
  let filePath;

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
    filePath = config.path +"/article1.md";
    this.storage = new StorageService(config);

  });

  it("get", async () => {
    
    let fileData = await storage.get(filePath);

    expect(fileData.length).to.equal(233);
  });

  it("set", async () => {
    let data = "boo hoo";
    let path = config.path + "/fsp_test.md";
    let result = await storage.set(path, data);

    expect(fs.existsSync(path)).to.equal(true);
    expect(result).to.equal(true);

    fs.removeSync(path);
  });

  it("copy directory", async () => {
    let src = config.path + "/images";
    let dest = config.output + "/images";
    
    await fs.remove(dest);
    await storage.copy(src, dest);

    expect(fs.readdirSync(dest).length).to.equal(4);

    fs.removeSync(dest);
  });

  it("exists", async () => {
    let path = filePath;

    let result = await storage.exists(path);

    expect(result).to.equal(true);
  });

  it("delete", async () => {
    let data = "boo hoo";
    let path = config.path + "/fsp_test.md";
    
    await storage.set(path, data);

    let result = await storage.delete(path);

    expect(result).to.equal(true);
  });

  it("getProvider", async () => {

    let result = await storage.getProvider();

    expect(result).not.equal(undefined);
  });

});