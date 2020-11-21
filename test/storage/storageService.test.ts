import { Config } from "../../src/config";
import { StorageService } from "../../src/storage/storageService";
import { Logger, transports } from "winston";
import * as fs from "fs-extra";

describe("Storage Service", () => {
  let config: Config = new Config();
  let storage: StorageService = new StorageService(config);
  let filePath = "";

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
    filePath = config.path +"/article1.md";
    storage = new StorageService(config);

  });

  it("get", async () => {
    
    let fileData = await storage.get(filePath);

    if(fileData) {
      expect(fileData.length).toBe(233);
    } else {
      fail();
    }
  });

  it("set", async () => {
    let data = "boo hoo";
    let path = config.path + "/fsp_test.md";
    let result = await storage.set(path, data);

    expect(fs.existsSync(path)).toBe(true);
    expect(result).toBe(true);

    fs.removeSync(path);
  });

  it("copy directory", async () => {
    let src = config.path + "/images";
    let dest = config.output + "/images";
    
    await fs.remove(dest);
    await storage.copy(src, dest);

    expect(fs.readdirSync(dest).length).toBe(4);

    fs.removeSync(dest);
  });

  it("exists", async () => {
    let path = filePath;

    let result = await storage.exists(path);

    expect(result).toBe(true);
  });

  it("delete", async () => {
    let data = "boo hoo";
    let path = config.path + "/fsp_test.md";
    
    await storage.set(path, data);

    let result = await storage.delete(path);

    expect(result).toBe(true);
  });

  it("getProvider", async () => {

    let result = await storage.getProvider();

    expect(result).toBeDefined();
  });

});