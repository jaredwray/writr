import * as fs from "fs-extra";
import {Config} from "../../src/config";
import {ConsoleMessage} from "../../src/log";
import {FileStorageProvider} from "../../src/storage/fileStorageProvider";

describe("File Storage Provider", () => {
  let config: Config = new Config();
  let fileStorageProvider: FileStorageProvider = new FileStorageProvider();
  let filePath = "";

  jest.spyOn(ConsoleMessage.prototype, "info").mockImplementation(() => {});
  jest.spyOn(ConsoleMessage.prototype, "error").mockImplementation(() => {});

  beforeEach(async () => {
    config.loadConfig("./blog_example/config.json");
    filePath = config.path +"/article1.md";
    fileStorageProvider = new FileStorageProvider();
  });

  afterAll(async () => {
    fs.removeSync("fsp_test.log");
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
    let result = await fileStorageProvider.exists(filePath);

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

  it("should console error when some method fails", async () => {
    const path = config.path + "/foo.md";

    jest.spyOn(fs, "readFile").mockImplementation(() => {
      throw new Error("readFile failed");
    });

    jest.spyOn(fs, "remove").mockImplementation(() => {
      throw new Error("remove failed");
    });

    jest.spyOn(fs, "ensureDir").mockImplementation(() => {
      throw new Error("copy failed");
    });

    await fileStorageProvider.get(path);
    await fileStorageProvider.delete(path);
    await fileStorageProvider.copy(path, path);

    expect(ConsoleMessage.prototype.error).toHaveBeenCalledTimes(3);
  });

});
