import {Config} from "../../src/config";
import {StorageService} from "../../src/storage/storageService";
import fs from "fs-extra";

describe("Storage Service", () => {
  let config: Config = new Config();
  let storage: StorageService = new StorageService();
  let filePath = "";

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
    filePath = config.path +"/article1.md";
    storage = new StorageService();

  });

  it("get", async () => {

    const fileData = await storage.get(filePath);

    if(fileData) {
      expect(fileData.length).toBe(233);
    } else {
      fail();
    }
  });

  it("set", async () => {
    const data = "boo hoo";
    const path = config.path + "/fsp_test.md";
    const result = await storage.set(path, data);

    expect(fs.existsSync(path)).toBe(true);
    expect(result).toBe(true);

    fs.removeSync(path);
  });

  it("copy directory", async () => {
    const src = "./blog_example/images";
    const dest = "./test_output/images";

    await fs.remove(dest);
    await storage.copy(src, dest);

    expect(fs.readdirSync(dest).length).toBe(4);

    fs.removeSync(dest);
  });

  it("exists", async () => {
    const result = await storage.exists(filePath);

    expect(result).toBe(true);
  });

  it("delete", async () => {
    const data = "boo hoo";
    const path = config.path + "/fsp_test.md";

    await storage.set(path, data);

    const result = await storage.delete(path);

    expect(result).toBe(true);
  });

  it("getProvider", async () => {

    let result = await storage.getProvider();

    expect(result).toBeDefined();
  });

  it("readDir", async () => {

    const data = 'content';
    let path = './test_output/storage/file.md';
    await storage.set(path, data);

    const result = storage.readDir('./test_output/storage');

    expect(result.length).toBe(1);

    fs.removeSync('./test_output/storage');
  });

});
