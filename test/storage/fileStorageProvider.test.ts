import { Config } from "../../src/config";
import { FileStorageProvider } from "../../src/storage/fileStorageProvider";
import { createLogger, transports } from "winston";
import * as fs from "fs-extra";

describe("File Storage Provider", () => {
  let config: Config = new Config();
  let fileStorageProvider: FileStorageProvider = new FileStorageProvider();
  let filePath = "";

  beforeEach(async () => {
    config.loadConfig("./blog_example/config.json");
    filePath = config.path +"/article1.md";
    fileStorageProvider = new FileStorageProvider();
    fileStorageProvider.log = createLogger({ transports: [new transports.File({ filename: "fsp_test.log"})] });

  });

  afterAll(async () => {
    fs.removeSync("fsp_test.log");
  });

  it("get file should show undefined", async () => {
    
    let fileData = await fileStorageProvider.get("");

    expect(fileData).toBeUndefined();
  });

  it("get file should show a string", async () => {
    
    let fileData = await fileStorageProvider.get(filePath);

    if(fileData) {
      expect(fileData.length).toBe(233);
    } else {
      fail();
    }

  });

  it("set file should show false on no data", async () => {
    let path = config.path + "/foo.md";

    let result = await fileStorageProvider.set(path, "");

    expect(result).toBe(false);
  });

  it("set file should show false on no path", async () => {
    let data = "boo hoo";

    let result = await fileStorageProvider.set("", data);

    expect(result).toBe(false);
  });

  it("set file should show false on undefined data", async () => {
    let path = config.path + "/foo.md";

    let result = await fileStorageProvider.set(path, undefined);

    expect(result).toBe(false);
  });

  it("set file should show false on undefined path", async () => {
    let data = "boo hoo";

    let result = await fileStorageProvider.set(undefined, data);

    expect(result).toBe(false);
  });

  it("set file should show true writing a file", async () => {
    let data = "boo hoo";
    let path = config.path + "/fsp_test.md";
    let result = await fileStorageProvider.set(path, data);

    expect(fs.existsSync(path)).toBe(true);
    expect(result).toBe(true);

    fs.removeSync(path);
  });

  it("copy directory show true", async () => {
    let src = config.path + "/images";
    let dest = config.output + "/images";
    
    await fs.remove(dest);
    await fileStorageProvider.copy(src, dest);

    expect(fs.readdirSync(dest).length).toBe(4);

    fs.removeSync(dest);
  });

  it("exist file should show false on bad path", async () => {
    let path = config.path + "/foo.md";

    let result = await fileStorageProvider.exists(path);

    expect(result).toBe(false);
  });

  it("exist file should show true on good path", async () => {
    let path = filePath;

    let result = await fileStorageProvider.exists(path);

    expect(result).toBe(true);
  });

  it("delete file should show true", async () => {
    let path = config.path + "/foo.md";

    let result = await fileStorageProvider.delete(path);

    expect(result).toBe(true);
  });

  it("delete file should show true", async () => {
    let data = "boo hoo";
    let path = config.path + "/fsp_test.md";
    
    await fileStorageProvider.set(path, data);

    let result = await fileStorageProvider.delete(path);

    expect(result).toBe(true);
  });

});