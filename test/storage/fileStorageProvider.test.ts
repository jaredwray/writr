import { expect } from "chai";
import { Config } from "../../src/config";
import { FileStorageProvider } from "../../src/storage/fileStorageProvider";
import { Logger, transports } from "winston";
import * as fs from "fs-extra";
import "mocha";
import { after } from "mocha";

describe("File Storage Provider", () => {
  let config: Config = new Config();
  let fileStorageProvider: FileStorageProvider = new FileStorageProvider();
  let filePath;

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
    filePath = config.path +"/article1.md";
    this.fileStorageProvider = new FileStorageProvider();
    fileStorageProvider.log = new Logger({ transports: [new transports.File({ filename: "fsp_test.log"})] });

  });

  after(() => {
    fs.removeSync("fsp_test.log");
  });

  it("get file should show undefined", async () => {
    
    let fileData = await fileStorageProvider.get("");

    expect(fileData).to.equal(undefined);
  });

  it("get file should show a string", async () => {
    
    let fileData = await fileStorageProvider.get(filePath);

    expect(fileData.length).to.equal(233);
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

  it("set file should show true writing a file", async () => {
    let data = "boo hoo";
    let path = config.path + "/fsp_test.md";
    let result = await fileStorageProvider.set(path, data);

    expect(fs.existsSync(path)).to.equal(true);
    expect(result).to.equal(true);

    fs.removeSync(path);
  });

  it("copy directory show true", async () => {
    let src = config.path + "/images";
    let dest = config.output + "/images";
    
    await fs.remove(dest);
    await fileStorageProvider.copy(src, dest);

    expect(fs.readdirSync(dest).length).to.equal(4);

    fs.removeSync(dest);
  });

  it("exist file should show false on bad path", async () => {
    let path = config.path + "/foo.md";

    let result = await fileStorageProvider.exists(path);

    expect(result).to.equal(false);
  });

  it("exist file should show true on good path", async () => {
    let path = filePath;

    let result = await fileStorageProvider.exists(path);

    expect(result).to.equal(true);
  });

  it("delete file should show true", async () => {
    let path = config.path + "/foo.md";

    let result = await fileStorageProvider.delete(path);

    expect(result).to.equal(true);
  });

  it("delete file should show true", async () => {
    let data = "boo hoo";
    let path = config.path + "/fsp_test.md";
    
    await fileStorageProvider.set(path, data);

    let result = await fileStorageProvider.delete(path);

    expect(result).to.equal(true);
  });

});